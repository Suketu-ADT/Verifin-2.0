"""
Optional low-memory mode: keep each model's token-embedding table as int8.

The table is the largest tensor in these models (the NLI model's is 128,100 x 768 floats, 375 MB of its 570 MB) and only a few
rows are read per request, so storing it as one int8 value per weight plus a per-row scale cuts it about fourfold. Rounding moves
a row's values by less than half a percent of its largest entry; measured on the NLI model, class probabilities move by about 0.002.
Linear layers are left in float32 on purpose: quantizing them as well moved probabilities by up to 0.4 in the same test.
"""

from __future__ import annotations

from typing import Any

import torch
from torch import nn

_CHUNK_ROWS = 8192  # convert a slice at a time so the float table is never copied whole


class Int8Embedding(nn.Module):
    """Read-only replacement for nn.Embedding: int8 rows with one float16 scale per row."""

    def __init__(self, weight: torch.Tensor, padding_idx: int | None = None):
        super().__init__()
        rows, dim = weight.shape
        q = torch.empty((rows, dim), dtype=torch.int8)
        scale = torch.empty((rows, 1), dtype=torch.float16)
        for start in range(0, rows, _CHUNK_ROWS):
            block = weight[start : start + _CHUNK_ROWS].float()
            s = (block.abs().amax(dim=1, keepdim=True) / 127.0).clamp_min(1e-8)
            q[start : start + _CHUNK_ROWS] = torch.round(block / s).to(torch.int8)
            scale[start : start + _CHUNK_ROWS] = s.half()
        self.q = nn.Parameter(q, requires_grad=False)
        self.scale = nn.Parameter(scale, requires_grad=False)
        self.padding_idx = padding_idx
        self.num_embeddings, self.embedding_dim = rows, dim

    def forward(self, ids: torch.Tensor) -> torch.Tensor:
        return self.q[ids].float() * self.scale[ids].float()


def shrink_input_embeddings(model: Any) -> int:
    """Swap a Hugging Face model's input embedding table for an Int8Embedding, in place.

    Returns the bytes saved, or 0 when the model has no table this can replace (already shrunk, or not a plain nn.Embedding).
    """
    table = model.get_input_embeddings()
    if not isinstance(table, nn.Embedding):
        return 0
    before = table.weight.numel() * table.weight.element_size()
    small = Int8Embedding(table.weight.data, table.padding_idx)
    model.set_input_embeddings(small)
    table.weight = nn.Parameter(torch.empty(0), requires_grad=False)  # release the float table now, not at the next collection
    after = small.q.numel() + small.scale.numel() * small.scale.element_size()
    return before - after

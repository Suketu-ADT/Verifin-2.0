"""Low-memory mode: an int8 embedding table must give nearly the same outputs in a quarter of the space."""

import torch
import transformers

from app.config import Settings
from app.services.low_memory import Int8Embedding, shrink_input_embeddings


def _tiny_bert():
    cfg = transformers.BertConfig(vocab_size=2000, hidden_size=32, num_hidden_layers=2, num_attention_heads=2, intermediate_size=64)
    torch.manual_seed(0)
    return transformers.BertModel(cfg).eval()


def test_embedding_rows_round_trip_within_rounding_error():
    weight = torch.randn(1000, 48)
    small = Int8Embedding(weight)
    ids = torch.tensor([[0, 5, 999], [17, 17, 3]])
    err = (small(ids) - torch.nn.functional.embedding(ids, weight)).abs()
    # half a quantisation step of each row's largest entry, plus float16 rounding of the scale
    assert err.max() < 0.006 * weight.abs().max()


def test_shrinking_a_model_saves_memory_and_keeps_outputs_close():
    model = _tiny_bert()
    ids = torch.randint(0, 2000, (4, 12))
    with torch.no_grad():
        before = model(input_ids=ids).last_hidden_state
    saved = shrink_input_embeddings(model)
    with torch.no_grad():
        after = model(input_ids=ids).last_hidden_state
    assert saved > 0.7 * 2000 * 32 * 4  # float table of 256 KB reduced to int8 plus row scales
    assert (before - after).abs().max() < 0.05


def test_shrinking_twice_is_a_no_op():
    model = _tiny_bert()
    assert shrink_input_embeddings(model) > 0
    assert shrink_input_embeddings(model) == 0


def test_low_memory_is_off_by_default():
    assert Settings().low_memory is False

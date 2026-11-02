"""When FRONTEND_DIST is set the API serves the built interface; its own routes and unknown API paths are unaffected."""

from fastapi.testclient import TestClient

from app.config import settings
from app.main import create_app


def _client(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>shell</html>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "secret.txt").write_text("outside")
    monkeypatch.setattr(settings, "frontend_dist", str(dist))
    return TestClient(create_app())


def test_shell_and_assets_are_served(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    assert client.get("/").text == "<html>shell</html>"
    assert client.get("/assets/app.js").text == "console.log(1)"


def test_client_side_routes_fall_back_to_the_shell(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    assert client.get("/verify/results/abc").text == "<html>shell</html>"


def test_api_routes_still_answer_and_unknown_api_paths_are_json_404(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    assert client.get("/api/v1/system/live").status_code == 200
    missing = client.get("/api/v1/nope")
    assert missing.status_code == 404 and missing.json() == {"detail": "Not found"}


def test_paths_cannot_escape_the_folder(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    assert client.get("/..%2fsecret.txt").text == "<html>shell</html>"
    assert client.get("/../secret.txt").text == "<html>shell</html>"


def test_nothing_is_served_when_the_setting_is_off(monkeypatch):
    monkeypatch.setattr(settings, "frontend_dist", None)
    assert TestClient(create_app()).get("/").status_code == 404

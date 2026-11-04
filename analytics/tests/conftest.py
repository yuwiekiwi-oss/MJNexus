import sys
from pathlib import Path

# パッケージをインストールせずに `pytest` を実行できるようにする
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

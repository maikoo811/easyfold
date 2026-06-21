[English](README.md) | **日本語**

> 📖 英語版が正本です。最新は [`README.md`](README.md) を参照してください。

# EasyFold

> **AlphaFold 3 の予測結果を Claude に聞こう。**

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/license-CC--BY--NC--SA--4.0-lightgrey.svg)](LICENSE)
[![Demo on Hugging Face Spaces](https://img.shields.io/badge/demo-Hugging%20Face%20Spaces-yellow.svg)](https://huggingface.co/spaces/maiko811/easyfold-demo)
[![Models: AlphaFold 3 + Boltz-2](https://img.shields.io/badge/models-AlphaFold%203%20%2B%20Boltz--2-teal.svg)](#モデルの選択)

> ⚠️ **研究用ツールです。** 医療・診断・臨床用途には使用できません。

![Build](docs/screenshots/input.png)

> **組み立て** — クリックでマルチチェーン アセンブリを作成。JSON 不要。

![Predict](docs/screenshots/result.png)

> **予測** — 自分の Modal GPU で実行。30 秒〜数分で 3D 構造と confidence チャートが出ます。

![Interpret](docs/screenshots/interpret.png)

> **解釈** — 自分の [Anthropic API キー](https://console.anthropic.com/) を持参して質問。Claude が実際の数値に基づいて答えます。

---

## EasyFold は何か

[AlphaFold 3](https://github.com/google-deepmind/alphafold3) と [Boltz-2](https://github.com/jwohlwend/boltz) を、コードを書けない研究者でも触れる Web UI にしたものです。配列を入れる → 自分の Modal GPU で予測 → 結果を Claude が解説する、という流れ。**配列もキーも自分のクラウドに留まる**設計です (zero-hosting OSS)。

他のラッパー (AFusion、Tamarind Bio、AlphaFold Server) と違うのは:

- **質問駆動の入力** — JSON スキーマを意識せず、研究者の言葉でクリック
- **LLM 解釈レイヤー** — 信頼度の数値を Claude が解説 + 次のアクション提案
- **2 モデル切替可** — AF3 (高品質、非商用) と Boltz-2 (MIT、商用 OK) をジョブごとに

---

## デモを試す

**[→ huggingface.co/spaces/maiko811/easyfold-demo](https://huggingface.co/spaces/maiko811/easyfold-demo)**

インストール / GPU / API キー不要。1TUP (p53)、1CRN (クランビン)、6LU7 (SARS-CoV-2 メインプロテアーゼ) を 3D で動かせます。

> ℹ️ デモの confidence 値は合成データです。実数値は Quickstart で。

---

## クイックスタート (約 10 分)

```bash
git clone https://github.com/maikoo811/easyfold.git
cd easyfold

cd backend && uv sync && uv run modal setup && cd ..
./modal/deploy.sh boltz       # 初回 5-10 分

# 起動 (2 ターミナル)
cd backend && uv run uvicorn easyfold.main:app --reload
cd frontend && pnpm install && pnpm dev
```

`http://localhost:3000` を開いて **P04637** (p53) を試すのがおすすめ。初回 ~10 分、2 回目以降 30 秒〜5 分。

**AlphaFold 3 を使う場合**は Google の weight 承認 (2-3 営業日) が必要。詳細は [`modal/README.md`](modal/README.md)。

---

## あなたのマシンから出るデータ

| 送信先 | 内容 |
|---|---|
| **api.colabfold.com** | タンパク質配列 (Boltz の MSA 取得用) |
| **UniProt / RCSB** | アクセッション ID のみ |
| **api.anthropic.com** | 統計サマリ + 質問のみ。キーはブラウザに留まる |

IP センシティブな配列の場合は ColabFold の影響をご確認ください。ジョブ URL の扱いその他は [`SECURITY.md`](SECURITY.md) を参照。

---

## モデルの選択

| 用途 | 推奨 | 待ち時間 |
|---|---|---|
| とりあえず試したい | HF デモ | 0 分 |
| アカデミック、最高品質 | **AlphaFold 3** | Google 承認 2-3 日 + 10 分 |
| 商用 / 創薬 | **Boltz-2** | 〜10 分 |
| PTM あり | **AlphaFold 3** | (Boltz は MVP で PTM 非対応) |

---

## ライセンス

EasyFold 自体は [**CC-BY-NC-SA 4.0**](LICENSE) (AlphaFold 3 のライセンス継承)。**Boltz-2 のみで運用すれば商用 OK** ([MIT](https://github.com/jwohlwend/boltz/blob/main/LICENSE))。詳細は法務チームでご確認を。

## 一緒に作る

バグ、改善案、ひとことフィードバック歓迎です。**[Issues](https://github.com/maikoo811/easyfold/issues)** / **[Discussions](https://github.com/maikoo811/easyfold/discussions)** までどうぞ。開発フローは [`CLAUDE.md`](CLAUDE.md)。

## 立っている肩

[AlphaFold 3](https://github.com/google-deepmind/alphafold3) (DeepMind、2024 年ノーベル化学賞)・[Boltz-2](https://github.com/jwohlwend/boltz) (Wohlwend et al., MIT)・[Mol\*](https://molstar.org/)・[ColabFold](https://github.com/sokrypton/ColabFold) (Mirdita et al.)・[Modal](https://modal.com/)・[Anthropic Claude](https://www.anthropic.com/) — どれが欠けても成立しません。

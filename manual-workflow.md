# Manual Workflow (No CLI Helper)

> CLI ツールを使わず **すべて手作業** で Git worktree + direnv + tmux を運用する手順例です。
>
> `~/projects/repos/` 直下に worktree を並べ、`~/projects/configs/` に設定を集約する構成を想定しています。

---

## 0. 前提条件

- git ≥ 2.33
- node ≥ 18（プロジェクトが Node の場合）
- direnv ≥ 2.32
- tmux ≥ 3

---

## 1. ディレクトリ準備

```bash
# 設定ファイル置き場（初回のみ）
mkdir -p "$HOME/projects/configs"

# リポジトリ用ワークスペース
mkdir -p "$HOME/projects/repos"
```

---

## 2. リポジトリ取得 & メイン worktree 作成

```bash
cd ~/projects/repos

git clone git@github.com:you/myrepo.git myrepo-main
cd myrepo-main

# ブランチを確認
git status -sb
```

### 設定ファイル初期化

```bash
mkdir -p "$HOME/projects/configs/myrepo"
cp .env.example "$HOME/projects/configs/myrepo/.env"
cp .env.local.example "$HOME/projects/configs/myrepo/.env.local"
```

---

## 3. .envrc を手書き

`myrepo-main/.envrc` を作成：

```bash
cat > .envrc <<'EOF'
REPO_NAME=$(basename $(git rev-parse --show-toplevel))
CONFIG_DIR="$HOME/projects/configs/$REPO_NAME"

if [ -d "$CONFIG_DIR" ]; then
  [ -f "$CONFIG_DIR/.env" ] && dotenv "$CONFIG_DIR/.env"
  [ -f "$CONFIG_DIR/.env.local" ] && dotenv "$CONFIG_DIR/.env.local"
fi
EOF

direnv allow  # 初回のみ
```

---

## 4. 追加 worktree を手動で作成

```bash
# 例) feature/login-ui ブランチ
cd ~/projects/repos/myrepo-main

git switch -c feature/login-ui  # まだ存在しない場合

# worktree を親フォルダと同列に配置
cd ..
git -C myrepo-main worktree add myrepo-feature-login-ui feature/login-ui

cd myrepo-feature-login-ui

# .envrc をコピー or symlink（今回は symlink）
ln -s ../myrepo-main/.envrc .envrc

direnv allow  # 各 worktree で一度だけ
```

環境変数が正しく読み込まれるかテスト：

```bash
node -e 'console.log(process.env.TEST_VALUE)'
```

---

## 5. tmux でレイアウトを組む

```bash
tmux new-session -s myrepo -c ~/projects/repos/myrepo-main -n main
# ウィンドウ追加
# :new-window -c ~/projects/repos/myrepo-feature-login-ui -n feature
# 必要に応じて pane-split
```

ステータスバーや key-binding は `.tmux.conf` で各自設定。

---

## 6. 設定ファイル変更の反映

1. `projects/configs/myrepo/.env` を編集。
2. 各 worktree で `direnv reload` （またはシェル再入）

**逆方向に反映したい場合**：worktree 側で変更 → 手動で `cp` または `rsync` して `projects/configs/` にコピー。

---

## 7. クリーンアップ

```bash
# worktree を削除
cd ~/projects/repos/myrepo-main
git worktree remove ../myrepo-feature-login-ui

git branch -D feature/login-ui  # 不要なら

# 残った symlink / empty dir を確認して手動削除
```

---

## 8. 注記

- CI では `direnv export` で環境変数を読み込み、ジョブに渡す。
- bare リポジトリ運用に切り替える場合：
  - `git clone --bare` → `git worktree add` の流れでも同じ。
- 複数サービス構成（monorepo）は `configs/myrepo/<subdir>/` を作り `.env` を分けて管理。

---

> 手動運用は柔軟ですが、操作忘れやヒューマンエラーが増えやすいので、将来的に CLI ツール化して自動化することを推奨します。

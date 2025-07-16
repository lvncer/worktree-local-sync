# Git Worktree Local File Sync

## 解決策の提案

### 1. シェルスクリプトによる自動コピー

```bash
#!/bin/bash
# copy-local-files.sh
# 使用方法: ./copy-local-files.sh <source-dir> <worktree-dir>

SOURCE_DIR=$1
WORKTREE_DIR=$2

# コピーしたいローカルファイルのリスト
LOCAL_FILES=(
    ".env"
    ".env.local"
    ".claude"
    # 必要に応じて追加
)

# 各ファイルをコピー
for file in "${LOCAL_FILES[@]}"; do
    if [ -f "$SOURCE_DIR/$file" ]; then
        cp "$SOURCE_DIR/$file" "$WORKTREE_DIR/$file"
        echo "Copied: $file"
    fi
done
```

### 2. Git hooks を使った自動化

```bash
# .git/hooks/post-checkout に設定
#!/bin/bash
# worktree作成時に自動的にローカルファイルをコピー

if [ "$GIT_CHECKOUT_TYPE" = "1" ]; then
    # メインディレクトリを特定
    MAIN_DIR=$(git worktree list | head -n1 | awk '{print $1}')
    CURRENT_DIR=$(pwd)

    # ローカルファイルをコピー
    for file in .env .env.local .claude; do
        [ -f "$MAIN_DIR/$file" ] && cp "$MAIN_DIR/$file" "$CURRENT_DIR/"
    done
fi
```

### 3. Makefile を使った管理

```makefile
# Makefile
.PHONY: setup-worktree

setup-worktree:
    @echo "Setting up worktree with local files..."
    @git worktree add $(WORKTREE_PATH) $(BRANCH)
    @cp .env $(WORKTREE_PATH)/.env 2>/dev/null || true
    @cp .env.local $(WORKTREE_PATH)/.env.local 2>/dev/null || true
    @cp .claude $(WORKTREE_PATH)/.claude 2>/dev/null || true
    @echo "Worktree setup complete!"
```

### 4. symlink を使った共有（注意が必要）

```bash
# ローカルファイルをシンボリックリンクで共有
ln -s /path/to/main/.env /path/to/worktree/.env
```

※ ただし、worktree 間で設定を共有したくない場合は不適切

これらの方法は確かに優れたアプローチですね！それぞれの実現方法を具体的に説明します。

### 5. リポジトリ外に置く方法（推奨）

#### ディレクトリ構造

```sh
~/projects/
├── configs/                # 設定ファイル置き場
│   ├── myproject/
│   │   ├── .env
│   │   ├── .env.local
│   │   └── .claude
│   └── another-project/
│       └── .env
└── repos/                  # リポジトリ置き場
    ├── myproject.git/      # bare repository
    ├── myproject-main/     # worktree
    └── myproject-feature/  # worktree
```

#### 実装例

```bash
# ~/.bashrc or ~/.zshrc に追加
export PROJECT_CONFIG_DIR="$HOME/projects/configs"

# プロジェクトごとに設定を読み込む関数
load_project_config() {
    local project_name=$(basename $(git rev-parse --show-toplevel))
    local config_dir="$PROJECT_CONFIG_DIR/$project_name"

    if [ -d "$config_dir" ]; then
        # 設定ファイルをsymlinkまたは環境変数として読み込む
        for file in "$config_dir"/.env*; do
            [ -f "$file" ] && export $(cat "$file" | xargs)
        done
    fi
}

# cdしたときに自動実行
cd() {
    builtin cd "$@" && [ -d .git ] && load_project_config
}
```

### 6. direnv を使う方法

#### セットアップ

```bash
# direnvをインストール
brew install direnv  # macOS
# または
sudo apt-get install direnv  # Ubuntu

# シェルにフックを追加
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc  # zshの場合
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc  # bashの場合
```

#### .envrc ファイルの作成

```bash
# プロジェクトのルートに.envrcを作成
cat > .envrc << 'EOF'
# --- 高度なパス解決 ---
#  monorepo / multi-repo の両方に対応するため、
#  1) リポジトリ名
#  2) サブディレクトリ（パッケージ名など）
#  3) ブランチ名 (任意)
#  の 3 階層までを設定検索パスとして扱う。

REPO_NAME=$(basename $(git rev-parse --show-toplevel))
SUBDIR=$(realpath --relative-to=$(git rev-parse --show-toplevel) "$PWD")  # "." ならルート
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)

# 優先度: repo/subdir/branch > repo/subdir > repo
SEARCH_DIRS=(
  "$HOME/projects/configs/$REPO_NAME/$SUBDIR/$BRANCH_NAME"
  "$HOME/projects/configs/$REPO_NAME/$SUBDIR"
  "$HOME/projects/configs/$REPO_NAME"
)

for CONFIG_DIR in "${SEARCH_DIRS[@]}"; do
  if [ -d "$CONFIG_DIR" ]; then
    echo "Loading configs from $CONFIG_DIR" >&2
    [ -f "$CONFIG_DIR/.env" ] && dotenv "$CONFIG_DIR/.env"
    [ -f "$CONFIG_DIR/.env.local" ] && dotenv "$CONFIG_DIR/.env.local"
    [ -f "$CONFIG_DIR/.claude" ] && ln -sf "$CONFIG_DIR/.claude" .claude
    break
  fi
done

# 設定ファイルが存在すれば読み込む
if [ -d "$CONFIG_DIR" ]; then
    [ -f "$CONFIG_DIR/.env" ] && dotenv "$CONFIG_DIR/.env"
    [ -f "$CONFIG_DIR/.env.local" ] && dotenv "$CONFIG_DIR/.env.local"

    # .claudeファイルをsymlinkする
    [ -f "$CONFIG_DIR/.claude" ] && ln -sf "$CONFIG_DIR/.claude" .claude
fi

# または、親ディレクトリの設定を継承
source_up_if_exists .envrc
EOF

# direnvを許可
direnv allow
```

### 7. git worktree add をラップする方法

#### ラッパースクリプト

```bash
#!/bin/bash
# git-worktree-with-config

# git worktree addの元の引数を処理
git worktree add "$@"

# 最後の引数（新しいworktreeのパス）を取得
WORKTREE_PATH="${!#}"

# メインworktreeを特定
MAIN_WORKTREE=$(git worktree list | head -n1 | awk '{print $1}')

# ローカルファイルをコピーまたはsymlink
if [ -d "$WORKTREE_PATH" ]; then
    echo "Setting up local config files..."

    # オプション1: symlink（設定を共有したい場合）
    for file in .env .env.local .claude; do
        if [ -f "$MAIN_WORKTREE/$file" ]; then
            ln -sf "$MAIN_WORKTREE/$file" "$WORKTREE_PATH/$file"
            echo "Linked: $file"
        fi
    done

    # オプション2: コピー（独立した設定にしたい場合）
    # for file in .env .env.local .claude; do
    #     if [ -f "$MAIN_WORKTREE/$file" ]; then
    #         cp "$MAIN_WORKTREE/$file" "$WORKTREE_PATH/$file"
    #         echo "Copied: $file"
    #     fi
    # done
fi
```

#### Git alias として設定

```bash
git config --global alias.wta '!git-worktree-with-config'
# 使用: git wta ../myproject-feature feature-branch
```

#### post-checkout フックの改良版

```bash
#!/bin/bash
# .git/hooks/post-checkout

# worktree作成時のみ実行
if [ "$3" = "1" ] && git worktree list | grep -q $(pwd); then
    # 設定ディレクトリから自動的にリンク
    PROJECT_NAME=$(basename $(git rev-parse --show-toplevel))
    CONFIG_DIR="$HOME/projects/configs/$PROJECT_NAME"

    if [ -d "$CONFIG_DIR" ]; then
        for file in "$CONFIG_DIR"/.env* "$CONFIG_DIR"/.claude; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                ln -sf "$file" "$filename"
                echo "Linked config: $filename"
            fi
        done
    fi
fi
```

---

### 将来的に実現したい自動化

1. **npm パッケージ化 / CLI ツール**

   - `npx worktree-sync init` のようなコマンドで、以下を一括実行できるようにする。
     - worktree の作成/削除
     - `direnv` 用 `.envrc` の自動生成
     - ローカル設定ファイル (.env\*, .claude など) のシンボリックリンク配置

2. **tmux 連携**

   - worktree を追加すると自動で tmux セッションを生成。
   - 各 worktree 毎にウィンドウやペインを分割し、ステータスバーにブランチ名を表示。
   - `npx worktree-sync tmux` で既存 worktree をまとめてレイアウトできるようにする。

3. **クロスプラットフォーム対応**

   - macOS / Linux / WSL で動作確認
   - `package.json` で必要な依存ツール (tmux, direnv, git >= 2.33) をチェックし、未インストールなら警告。

4. **CI 連携**
   - GitHub Actions などで `.envrc` の内容を環境変数に読み込み、ブランチごとのテストを自動化できるようにする。

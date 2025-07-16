# Git Worktree Local File Sync

Git worktree で.gitignore されたローカルファイルがコピーされない問題について、いくつかの解決策を提案させていただきます。

## Solution

**Git hooks + リポジトリ外に置く** の組み合わせが最もバランスが良いと考えます。物理的にファイルをコピーすることで、設定が壊れるリスクを最小化できるという安心感があります。

- worktree 作成時に `post-checkout` フックで設定ファイルを _コピー_ するため、各 worktree が独立していて壊れにくい
- 設定ファイルをリポジトリ外の `~/projects/configs/<project>` に置くことで誤コミットを防ぎつつ、共有もしやすい
- 追加ツールなしで Git だけで完結する（direnv が不要）
- symlink ではなくコピーなので、誤って上書き・削除してしまうリスクが低い

---

## Directory Structure

```sh
projects/
├── configs/                      # 設定ファイル置き場
│   ├── .claude/
│   ├── CLAUDE.md
│   ├── .mcp.json
│   ├── .cursor/
│   ├── .cursorrules
│   ├── .windsurf/
│   ├── .windsurfrules
│   ├── .env
│   └── .env.local
└── repos/                        # リポジトリ置き場
    ├── myproject.git/            # bare repository
    │  └── hooks/post-checkout
    ├── myproject-main/           # worktree
    └── myproject-feature/        # worktree
```

## Setup / Execution Steps

**注意**: 全てのコマンドは `/projects` で実行することを前提としています。

1. Bare Repository Setup (git clone --bare)

   まずはリモートリポジトリを bare 形式でクローンしておきます。

   ```bash
   # 例: GitHub からクローン
   git clone --bare git@github.com:yourname/myproject.git ~/projects/repos/myproject.git
   ```

   `--bare` を付けることで、作業ツリーを持たない「中枢」リポジトリが出来上がります。
   以降はこの bare リポジトリに対して `git worktree add` を実行して
   任意の場所に作業ツリー（ブランチ）を展開していきます。

2. (準備) `/configs/` に `.env`, `.env.local`, `.claude` など必要なファイルを置く。
3. bare リポジトリ `projects/repos/myproject.git/` の `hooks/` に `post-checkout` フックを配置して、worktree 作成時に上記ファイルをコピーする。

   ```bash
   #!/usr/bin/env bash
   WORKTREE_DIR="$(git rev-parse --show-toplevel)"
   COMMON_DIR="$(git rev-parse --git-common-dir)"
   PROJECT_ROOT="$(dirname "$(dirname "$COMMON_DIR")")"
   CONFIG_DIR="$PROJECT_ROOT/configs"

   if [ -d "$CONFIG_DIR" ]; then
   rsync -a "$CONFIG_DIR"/ "$WORKTREE_DIR"/
   fi
   ```

4. 初回の作業ツリーを作成（例: `main` ブランチ）：

   ```bash
   git -C projects/repos/myproject.git worktree add ../myproject-main main
   ```

5. 新しいブランチ用に worktree を追加（ブランチが無い場合は自動で作成）：

   ```bash
   # ブランチが存在しない場合は -b で自動作成
   git -C projects/repos/myproject.git worktree add -b feature-branch ../myproject-feature
   ```

6. 各 worktree で作業開始すると、フックにより `.env*` などが自動でコピーされていることを確認。

> これでブランチを増やしても毎回環境変数ファイルを手動コピーする必要がなくなります。

### 注意: 'hooks/post-checkout' が無効化される警告

`git worktree add` 実行時に次のようなメッセージが表示されることがあります。

```text
hint: The 'hooks/post-checkout' hook was ignored because it's not set as executable.
hint: You can disable this warning with `git config advice.ignoredHook false`.
```

これは `hooks/post-checkout` フックに実行権限 (`+x`) が付いていないためです。以下のいずれかで対応してください。

1. フックを実行したい場合

   ```bash
   chmod +x <bare-repo-path>/hooks/post-checkout
   ```

2. フックは使わず警告だけ抑制したい場合

   ```bash
   git config --global advice.ignoredHook false
   ```

### worktree 一覧を見る方法

```bash
git -C repos/lt.git worktree list
```

### worktree を削除する方法

```bash
git -C repos/lt.git worktree remove ../lt-main
```

## tmux でのワークツリー切り替え Tips

複数の worktree を同時に開発する際に便利な tmux の使い方例です。

1. **1 セッション = 1 プロジェクト**

   ```bash
   tmux new -s myproject -c /repos/myproject-main
   ```

2. **ブランチ／作業ツリーごとにウィンドウを分ける**

   ```bash
   tmux new-window -n feature -c /repos/myproject-feature
   ```

### 超基本コマンド Tips

1. 新しいウィンドウを開く: `Ctrl+b → c`
2. ウィンドウを切り替える: `Ctrl+b → n`（next） / `p`（prev）
3. セッションを終了: `exit` でシェルを抜ける or `Ctrl+b → &`
4. 横に分割（左右ペイン） : `Ctrl+b → %`
5. 縦に分割（上下ペイン） : `Ctrl+b → "`
6. ペイン間の移動（矢印で OK） : `Ctrl+b → ← / → / ↑ / ↓`
7. ペインを閉じる : そのペインで `exit`

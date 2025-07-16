# Git Worktree Local File Sync

Git worktree で.gitignore されたローカルファイルがコピーされない問題について、いくつかの解決策を提案させていただきます。

## Solution

**Git hooks + リポジトリ外に置く** の組み合わせが最もバランスが良いと考えます。物理的にファイルをコピーすることで、設定が壊れるリスクを最小化できるという安心感があります。

- worktree 作成時に `post-checkout` フックで設定ファイルを _コピー_ するため、各 worktree が独立していて壊れにくい
- 設定ファイルをリポジトリ外の `~/projects/configs/<project>` に置くことで誤コミットを防ぎつつ、共有もしやすい
- 追加ツールなしで Git だけで完結する（direnv が不要）
- symlink ではなくコピーなので、誤って上書き・削除してしまうリスクが低い

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

1. (準備) `projects/configs/<project>/` に `.env`, `.env.local`, `.claude` など必要なファイルを置く。
2. bare リポジトリ `projects/repos/myproject.git/` の `hooks/` に `post-checkout` フックを配置して、worktree 作成時に上記ファイルをコピーする。

   ```bash
   #!/bin/bash
   MAIN_DIR=$(git worktree list | head -n1 | awk '{print $1}')
   CONFIG_DIR="$HOME/projects/configs/$(basename "$MAIN_DIR")"
   # config ディレクトリ内のファイル／ディレクトリをすべてコピー
   rsync -a "$CONFIG_DIR/" "$PWD/"
   ```

3. 初回の作業ツリーを作成（例: `main` ブランチ）：

   ```bash
   git -C projects/repos/myproject.git worktree add ../myproject-main main
   ```

4. 新しいブランチ用に worktree を追加（ブランチが無い場合は自動で作成）：

   ```bash
   git -C projects/repos/myproject.git worktree add ../myproject-feature feature-branch
   ```

5. 各 worktree で作業開始すると、フックにより `.env*` などが自動でコピーされていることを確認。

> これでブランチを増やしても毎回環境変数ファイルを手動コピーする必要がなくなります。

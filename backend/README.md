## How to manage Python projects with UV
- `uv init`: Create a new Python project with a pyproject.toml file, which contains all information for this project, similar to package.json in Node.js project.
- `uv add`: Add a dependency to the project, instead of pip install, uv add will add the package to pyproject.toml environment.
- `uv remove`: Remove a dependency from the project.
- `uv sync`: Sync the project's dependencies with the environment, similar to npm install.
- `uv lock`: Create a lockfile for the project's dependencies.
- `uv run`: Run a command in the project environment.
- `uv tree`: View the dependency tree for the project.
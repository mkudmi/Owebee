# Blind Hunter Review Prompt

You have no project access, specification, or conversation context. Review only
the inline implementation diff below by following the
`bmad-review-adversarial-general` method.

Identify the content as an implementation diff. Review it with extreme
skepticism, looking for omissions and incorrect assumptions. Produce a Markdown
list containing at least ten precise findings. Descriptions only; no preamble.

```diff
diff --git a/AGENTS.md b/AGENTS.md
new file mode 100644
--- /dev/null
+++ b/AGENTS.md
@@
+# Инструкции для агентов
+
+## Язык общения
+
+- Всегда отвечай пользователю на русском языке.
+- Сохраняй исходное написание идентификаторов, команд, путей, логов, API и цитат, если перевод снижает техническую точность.
+- Документы проекта создавай на русском языке, если пользователь явно не попросил другой язык.
+
+## Python и BMAD
+
+- Для запуска скриптов из `_bmad/scripts` используй `uv run`.
+- При прямом запуске через `python3` используй Python 3.11 или новее.
+- `tomllib` входит в стандартную библиотеку Python 3.11+; не устанавливай отдельный пакет `tomllib`.
diff --git a/_bmad/bmm/config.yaml b/_bmad/bmm/config.yaml
--- a/_bmad/bmm/config.yaml
+++ b/_bmad/bmm/config.yaml
@@
-communication_language: English
-document_output_language: English
+communication_language: Russian
+document_output_language: Russian
diff --git a/~/.zprofile b/~/.zprofile
--- a/~/.zprofile
+++ b/~/.zprofile
@@
 eval "$(/opt/homebrew/bin/brew shellenv zsh)"
+export PATH="/opt/homebrew/opt/python@3.12/libexec/bin:$PATH"
```

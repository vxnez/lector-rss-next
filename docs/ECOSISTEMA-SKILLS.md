# Ecosistema de Skills — RSS Dashboard (`lector-rss-next`)

Activas (14, elegidas por el usuario): `archify`, `spec-driven-development`, `using-agent-skills`, `refactor-clean`, `awesome-code-review`, `awesome-architecture-audit`, `vercel-react-best-practices`, `ui-ux-design-system`, `css-variables-theming`, `client-side-routing-history`, `mobile-touch-optimization`, `state-management-hooks`, `tgrep`, `ui-pro-max`.

## Uso por componente solicitado

1. **Archify** (instalado `~/.agents/skills/archify`, verificado con `doctor`): `node ~/.agents/skills/archify/bin/archify.mjs validate architecture <json> --quality showcase --json`, luego `deliver`. Escaneos periódicos de `src/app + src/lib + src/data`.
2. **Superpowers → `spec-driven-development`**: protocolo en `.agents/workflows/plan-execute-verify.md`. No se instala Superpowers; el flujo Plan→Execute→Verify es obligatorio.
3. **Agent Skills**: directorio `.agents/skills` (38 skills proyecto). Nuevas skills con frontmatter `name/description` + `SKILL.md`.
4. **Ponytail → `refactor-clean`**: simplicidad, un solo dueño por concepto, medir con `git diff --numstat`.
5. **DeepSeek Harness**: no instalado. Equivalente actual: `rss-parser` + `scripts/verify-feeds.js` desacoplados en `src/lib`.
6. **Matt Pocock → `vercel-react-best-practices`**: tipos TS y contratos API.
7. **Open Code Review → `awesome-code-review`**: gate `npm run lint` pre-commit/PR.
8. **SWE-ReX**: no instalado. Equivalente: validación local (`verify-feeds.js`, `next build`), sin sandbox aislado.
9. **Beads**: sin ramas de memoria dedicadas. Equivalente parcial: git + `CONTEXTO_BACKEND.md` / `CONTEXTO_FRONTEND.md`.
10. **GitMCP**: sin servidor MCP dedicado. Equivalente: `git-workflow-and-versioning` (global).

Mapa máquina: `.agents/ecosystem.json`.

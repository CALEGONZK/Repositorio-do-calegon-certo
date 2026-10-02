# Campeonato App — EA FC 26 Pro Clubs

## Como rodar
1. Instale Node.js 18+.
2. Dentro desta pasta: `npm install`
3. Defina `ADMIN_TOKEN` e execute `npm start`.
4. Abra `http://localhost:3000`.

## Integração FC 26
- Busca clubes pelo nome usando o endpoint de busca do Pro Clubs.
- Seleciona plataforma: `common-gen5` (PS5/Xbox Series/PC) ou `common-gen4` (PS4/Xbox One).
- Mostra os resultados para o capitão escolher o clube correto.
- Consulta informações do clube e importa os membros automaticamente.
- Salva `clubId`, plataforma, informações do EA e jogadores no `db.json`.
- Permite sincronizar novamente o elenco pela rota `POST /api/campeonatos/:id/times/:timeId/atualizar`.
- O navegador nunca acessa a EA diretamente; a consulta é feita pelo backend.

## Rotas principais
- `GET /api/ea/clube/:nome?platform=common-gen5` — busca clubes.
- `GET /api/ea/clube/:clubId/elenco?platform=common-gen5` — consulta clube + elenco.
- `POST /api/campeonatos/:id/inscrever` — vincula clube e importa elenco.
- `POST /api/campeonatos/:id/times/:timeId/atualizar` — sincroniza elenco.

## Importante
A integração usa endpoints não oficiais/não documentados do serviço de Pro Clubs da EA. Eles podem mudar, exigir ajustes ou sofrer bloqueios/rate limits. O código inclui timeout, retry e fallback entre endpoints de membros.

O armazenamento atual é `db.json`, adequado para testes. Para produção, use um banco real.

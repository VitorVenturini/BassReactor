# DJ Visualizer

O projeto agora tem duas apps separadas:

- `legacy.html`: versao antiga, estatica, no estilo original HTML + CSS + JS.
- `vue.html`: nova app Vue 3 + Vite com renderer proprio em WebGL, inspirada no fluxo visual do Kaleidosync e alimentada por audio do desktop.

A raiz `index.html` virou uma pagina de escolha entre as duas.

## Stack

- Vue 3
- Vite
- Canvas 2D
- Captura de audio com `getDisplayMedia`

## Como rodar

1. Entre na pasta do projeto.
2. Instale as dependencias:

```powershell
npm install
```

3. Suba o servidor:

```powershell
npm run dev
```

4. Abra no navegador:

- `http://localhost:5173/` para escolher a app
- `http://localhost:5173/legacy.html` para a versao antiga
- `http://localhost:5173/vue.html` para a versao Vue

## Desktop (Electron)

- `npm run dev:desktop`: abre o app desktop em modo dev (Vite + Electron).
- `npm run desktop`: gera o build web e abre no Electron.
- `npm run clean:release`: remove artefatos antigos de build (`release/` e `release-new/`).
- `npm run dist:win`: limpa artefatos antigos e gera executavel Windows (`.exe`) portatil na pasta `release/`.

No modo Electron, o atalho global do sistema `Numpad /` (tecla `/` do numpad) troca o design de forma aleatoria mesmo com o app em segundo plano.

## Build

```powershell
npm run build
npm run preview
```

## Estrutura

- `legacy.html`: entrada da app antiga.
- `vue.html`: entrada da app Vue.
- `index.html`: launcher entre as duas.
- `src/App.vue`: UI da versao Vue.
- `src/components/KaleidosyncStage.vue`: renderer WebGL da versao Vue.
- `src/composables/useDesktopAudio.js`: captura e analise do audio do desktop para a versao Vue.
- `app.js`: motor atual de captura, animacao e render da versao legacy.
- `styles.css`: estilos base usados pelo legado e pela shell Vue.
- `public/visualizer-popup.html`: popup compartilhado pelo renderer.

## Observacao

- A versao Vue nao depende mais do DOM legado para renderizar a cena principal.
- A versao legacy continua intacta e usa `app.js`.

# moroboxai-player-sdk

[![NPM version](https://img.shields.io/npm/v/moroboxai-player-sdk.svg)](https://www.npmjs.com/package/moroboxai-player-sdk)
![Node.js CI](https://github.com/moroboxai/moroboxai-player-sdk/workflows/Node.js%20CI/badge.svg)
[![gitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/moroboxai/moroboxai-player-sdk/blob/master/LICENSE)
[![Code Quality: Javascript](https://img.shields.io/lgtm/grade/javascript/g/moroboxai/moroboxai-player-sdk.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/moroboxai/moroboxai-player-sdk/context:javascript)
[![Total Alerts](https://img.shields.io/lgtm/alerts/g/moroboxai/moroboxai-player-sdk.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/moroboxai/moroboxai-player-sdk/alerts)

This package provides the core functionalities for running [MoroboxAI](https://github.com/moroboxai) games on various platforms, but lacks the gutter that is required for some platform-specific functionalities.

See:

-   [moroboxai](https://github.com/moroboxai/moroboxai): for running games on the desktop with [Electron](https://www.electronjs.org/)
-   [moroboxai-player-web](https://github.com/moroboxai/moroboxai-player-web): for embedding games on the web
-   [moroboxai-player-react](https://github.com/moroboxai/moroboxai-player-react): for embedding games in [React](https://en.reactjs.org/) apps

## Install

Using npm:

```bash
npm install moroboxai-player-sdk --save
```

## Implementation

This package is meant to be extended by implementing the missing gutter for the desired platform:

```ts
import * as MoroboxAIPlayerSDK from 'moroboxai-player-sdk';

// The gutter added by our implementation
const sdkConfig: MoroboxAIPlayerSDK.ISDKConfig = {
 // Define how we create a file server on this platform
 fileServer: (baseUrl: string) => ...,
 // Define how we create a zip server on this platform
 zipServer: (baseUrl: string) => ...
};

// Retrieve the HTMLElement we want to attach the player to
const element: Element = ...;

// The generic options for the player
const options: MoroboxAIPlayerSDK.IPlayerOptions = ...;

// Entrypoint of moroboxai-player-sdk with our gutter
MoroboxAIPlayerSDK.init(sdkConfig, element, options);
```

## Sample

This package contains a sample that can be run with:

```bash
npm run dev
```

Then head to localhost:3000.

## License

This content is released under the [MIT](http://opensource.org/licenses/MIT) License.

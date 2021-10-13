# Monster UI Accounts

This is a sub application of [2600hz/monster-ui][monster-ui] that manages multi-tenant account hierarchy and configuration.

## Getting Started

### Prerequisites

Have [2600hz/monster-ui][monster-ui] set up.

### Install

Clone the `monster-ui-accounts` repository into `/monster-ui/src/apps/` such as:
```
$ cd monster-ui/src/apps/
$ git clone https://github.com/2600hz/monster-ui-accounts.git accounts
```

Then the [gulp workflow for 2600hz/monster-ui][monster-ui_build] can be applied for this new app.

## Running the tests

### Selenium IDE tests

A [Selenium IDE][selenium-ide] test project is included under the folder [tests][tests]. It contains a suite of tests that represent a happy path for the account wizard.

To run the test cases contained in this project, you have two options: run it via the Selenium IDE browser extension, or via the command line runner.

#### Run tests via the Selenium IDE

For this option the Selenium IDE extension should be [installed][selenium-ide_install] in a supported web browser.

Upon launching the IDE you will be presented with a dialog where you can choose the option **Open an existing project**, to search and open the test project file in your computer.

Then you can [play the tests cases back in the IDE][selenium-ide_play] by selecting the test or suite you'd like to play and clicking the play button in the menu bar above the test editor. This will play the tests in a browser window.

#### Run tests via the command line runner

For this option you need to install the [Selenium IDE command-line runner][selenium-ide_cli], and the driver for the browser of your choice.

Once everything is installed, the tests can be run by calling `selenium-side-runner` from the command-line followed by the path to the project file.

```sh
$ selenium-side-runner tests/wizard.side
```

[monster-ui]: https://github.com/2600hz/monster-ui
[monster-ui_build]: https://github.com/2600hz/monster-ui#build
[selenium-ide]: https://www.seleniumhq.org/selenium-ide/
[selenium-ide_cli]: https://www.seleniumhq.org/selenium-ide/docs/en/introduction/command-line-runner/
[selenium-ide_install]: https://www.seleniumhq.org/selenium-ide/docs/en/introduction/getting-started/#installation
[selenium-ide_play]: https://www.seleniumhq.org/selenium-ide/docs/en/introduction/getting-started/#in-browser
[tests]: tests/


# Test262 Harness Integration

This directory contains the WPT-specific infrastructure for running the [TC39 Test262](https://github.com/tc39/test262) suite within the Web Platform Tests framework. 

## Overview

Test262 tests are integrated into WPT using a "Window Wrapper" pattern. Each Test262 `.js` test is served as a `.test262.html` file that wraps the actual test execution in an isolated environment.

### Architecture

1.  **Top-Level Wrapper**: A standard WPT HTML file (`testharness.js`-enabled) that hosts a `test262-harness-bridge.js`. It contains an `<iframe>` where the actual test code runs.
2.  **Harness Bridge**: Listens for `postMessage` events from the iframe. It maps Test262 results to a single WPT `async_test`. It uses `setup({ explicit_done: true })` to ensure it captures results from both synchronous and asynchronous tests correctly.
3.  **Test Iframe**: The environment where the Test262 test executes. It includes:
    - **Harness Files**: Required Test262 harness files (e.g., `assert.js`, `sta.js`) from `third_party/test262/harness/`.
    - **Provider (`test262-provider.js`)**: Implements the `$262` host API required by the spec.
    - **Reporter (`test262-reporter.js`)**: Captures errors, handles async signals, and communicates with the parent bridge.

## Core Protocol (INTERPRETING.md)

This implementation strictly follows the [Test262 INTERPRETING.md](https://github.com/tc39/test262/blob/main/INTERPRETING.md) specification:

### Success and Failure
- A test **passes** if it completes its execution without throwing an uncaught exception.
- A test **fails** if it throws a `Test262Error`.
- Any other uncaught exception is reported as a harness **ERROR**.

### Asynchronous Tests (`async` flag)
Tests tagged with `async` must signal completion via the host-defined `print()` function:
- `print('Test262:AsyncTestComplete')` -> PASS
- `print('Test262:AsyncTestFailure: [reason]')` -> FAIL

The `$262.done()` (or `$DONE()`) helper is wired to this `print()` protocol.

### Negative Tests (`negative` flag)
Tests expecting an error are validated against their target `type` and `phase`. If such a test completes without throwing the expected error, it is reported as a failure.

## Advanced Features

### Strict Mode (`onlyStrict` flag)
Tests with the `onlyStrict` flag are served with a `"use strict";` preamble or within a strict script context as required by the spec.

### Modules (`module` flag)
Test262 module tests are served as `<script type="module">`. The runner uses dynamic `import()` to execute the test and handles completion once the module's top-level evaluation (and any async work) resolves.

### Realms and Agents
- **$262.createRealm()**: Supported via sub-iframes.
- **$262.agent**: Supported via Web Workers and `SharedArrayBuffer` for multi-threaded tests.

## Communication Protocol

The bridge uses a structured object mapping for communication between the executing iframe and the parent WPT test harness:
- `{ type: 'complete' }`: **OK** (Mapped to `t.done()`)
- `{ type: 'fail', message: '...' }`: **FAIL** (Mapped to `assert_unreached()`)
- `{ type: 'error', message: '...' }`: **ERROR** (Mapped to throwing a global harness `Error`)

*Note: Additional payload types like 'timeout' or 'precondition_failed' are reserved for future WPT-specific extensions such as automated feature-skipping.*

# Terms and Conditions

Last updated: August 18, 2025

By installing and using SNS-MyAgent ("snsagent", the "Application"), you agree to the following terms. If you do not agree, do not use this Application.

## 1. License

SNS-MyAgent is released under the MIT license. The source code is available on [GitHub](https://github.com/Reihantt6/sns-myagent). You are free to use, modify, and redistribute it under the terms of the MIT license.

## 2. Nature of the Application

SNS-MyAgent is a CLI (Command Line Interface) agent that runs in your terminal. The Application executes code (bash, eval, SSH, browser, MCP tools) on your behalf based on the commands you provide. You are fully responsible for every command executed and its results.

## 3. Bring Your Own Key (BYOK)

The Application does not provide access to AI models. You must supply your own API key from the provider of your choice (OpenAI, Anthropic, Ollama, or custom). API usage costs are entirely your responsibility. The Application is not liable for costs arising from use of your API key.

## 4. Privacy and Data

- Configuration and session data are stored locally under `~/.omp/agent/` on your device
- The Application does not send your data to third-party servers other than the LLM provider you select yourself
- Tokens and API keys are stored on the local device. Do not share your configuration files

## 5. Security

The Application runs code on your behalf. Read the [security model](./security-model.md) to understand authorization boundaries and tool approval behavior. Enable `autoApprove` only if you understand the risk.

## 6. Disclaimer

The Application is provided "AS IS" without warranty of any kind. There is no guarantee that the Application will function without errors or meet your specific needs. The SNS-MyAgent developers are not liable for losses arising from use of the Application.

## 7. Contributions

Contributions via pull request on GitHub are welcome. By contributing, you agree that your contribution is released under the same MIT license.

## 8. Changes to these Terms

These terms may change at any time. Changes will be published on this page. Continued use of the Application after changes constitutes acceptance of the updated terms.

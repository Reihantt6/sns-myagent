/**
 * Default configuration values for SNS-MyAgent.
 */

import * as os from "node:os";
import * as path from "node:path";
import { SNS_CONFIG_DIR_NAME } from "./sns-config.js";

/** Default LLM provider. */
export const DEFAULT_PROVIDER = "openrouter";

/** Default model — "auto" means first available. */
export const DEFAULT_MODEL = "auto";

/** Default config directory: ~/.sns-myagent/ */
export const DEFAULT_CONFIG_DIR = path.join(os.homedir(), SNS_CONFIG_DIR_NAME);

/** Default config file name. */
export const DEFAULT_CONFIG_FILE = "config.yaml";

/** Default YAML content written on first setup. */
export const DEFAULT_CONFIG_YAML = `# SNS-MyAgent configuration
# BYOK: set your API key via SNSMYAGENT_API_KEY env var or api_key below.

provider: ${DEFAULT_PROVIDER}
model: ${DEFAULT_MODEL}
# api_key: sk-your-key-here
`;

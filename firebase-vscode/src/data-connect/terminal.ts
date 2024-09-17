import { TelemetryLogger, TerminalOptions } from "vscode";
import { ExtensionBrokerImpl } from "../extension-broker";
import vscode, { Disposable } from "vscode";
import { checkLogin } from "../core/user";
import { DATA_CONNECT_EVENT_NAME } from "../analytics";
import { getSettings } from "../utils/settings";

const environmentVariables = {};

const terminalOptions: TerminalOptions = {
  name: "Data Connect Terminal",
  env: environmentVariables,
};

export function setTerminalEnvVars(envVar: string, value: string) {
  (environmentVariables as any)[envVar] = value;
}

export function runCommand(command: string) {
  const terminal = vscode.window.createTerminal(terminalOptions);
  terminal.show();
  terminal.sendText(command);
}

export function runTerminalTask(
  taskName: string,
  command: string,
): Promise<string> {
  const type = "firebase-" + Date.now();
  return new Promise(async (resolve, reject) => {
    vscode.tasks.onDidEndTaskProcess(async (e) => {
      if (e.execution.task.definition.type === type) {
        e.execution.terminate();

        if (e.exitCode === 0) {
          resolve(`Successfully executed ${taskName} with command: ${command}`);
        } else {
          reject(
            new Error(`Failed to execute ${taskName} with command: ${command}`),
          );
        }
      }
    });
    const task = await vscode.tasks.executeTask(
      new vscode.Task(
        { type },
        vscode.TaskScope.Workspace,
        taskName,
        "firebase",
        new vscode.ShellExecution(command),
      ),
    );
  });
}

export function registerTerminalTasks(
  broker: ExtensionBrokerImpl,
  telemetryLogger: TelemetryLogger,
): Disposable {
  const settings = getSettings();

  const loginTaskBroker = broker.on("executeLogin", () => {
    telemetryLogger.logUsage(DATA_CONNECT_EVENT_NAME.IDX_LOGIN);
    runTerminalTask(
      "firebase login",
      `${settings.firebasePath} login --no-localhost`,
    ).then(() => {
      checkLogin();
    });
  });

  const startEmulatorsTaskBroker = broker.on("runStartEmulators", () => {
    telemetryLogger.logUsage(DATA_CONNECT_EVENT_NAME.START_EMULATORS);
    // TODO: optional debug mode
    runTerminalTask(
      "firebase emulators",
      `${settings.firebasePath} emulators:start --debug`,
    );
  });

  return Disposable.from(
    { dispose: loginTaskBroker },
    vscode.commands.registerCommand(
      "firebase.dataConnect.runTerminalTask",
      (taskName, command) => {
        telemetryLogger.logUsage(DATA_CONNECT_EVENT_NAME.COMMAND_EXECUTION, {
          commandName: command,
        });
        runTerminalTask(taskName, command);
      },
    ),
  );
}

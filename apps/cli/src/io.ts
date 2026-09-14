/** Saídas da CLI. Injetadas para que os comandos possam ser testados sem o terminal real. */
export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export const processIo: CliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

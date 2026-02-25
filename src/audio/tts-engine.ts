export interface TTSEngine {
  synthesize(text: string, voice?: string): Promise<Buffer>;
}

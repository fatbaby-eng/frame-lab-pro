declare module 'gifshot' {
  interface CreateGIFOptions {
    images?: string[];
    video?: string[] | string;
    gifWidth?: number;
    gifHeight?: number;
    interval?: number;
    numFrames?: number;
    frameDuration?: number;
    fontWeight?: string;
    fontSize?: string;
    fontFamily?: string;
    fontColor?: string;
    textAlign?: string;
    textBaseline?: string;
    sampleInterval?: number;
    numWorkers?: number;
    progressCallback?: (captureProgress: number) => void;
    onChange?: (captureProgress: number) => void;
  }

  interface CreateGIFResult {
    error?: boolean;
    errorCode?: string;
    errorMsg?: string;
    image?: string;
    cameraStream?: MediaStream;
    code?: string;
    currentTime?: number;
    numFrames?: number;
    gifWidth?: number;
    gifHeight?: number;
    currentCaptureFrame?: number;
    webcamVideoElement?: HTMLVideoElement;
    savedRenderingContexts?: CanvasRenderingContext2D[];
    progress?: number;
  }

  function createGIF(options: CreateGIFOptions, callback: (result: CreateGIFResult) => void): void;

  export { createGIF };
  export default { createGIF };
}

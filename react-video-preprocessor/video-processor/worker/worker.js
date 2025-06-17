import CanvasRenderer from "./canvasRenderer.js"
import MP4Demuxer from "./mp4Demuxer.js"
import VideoProcessor from "./videoProcessor.js"
import WebMWriter from './../deps/webm-writer2.js'
import Service from "./service.js"

console.log('🚀 Initializing video processing worker');

const qvgaConstraints = {
    width: 320,
    height: 240
}
const vgaConstraints = {
    width: 640,
    height: 480
}
const hdConstraints = {
    width: 1280,
    height: 720
}

const encoderConfig = {
    ...hdConstraints,
    bitrate: 10e6,
    // WebM
    codec: 'vp8',
    pt: 4,
    hardwareAcceleration: 'prefer-software',

    // MP4
    // codec: 'avc1.42002A',
    // pt: 1,
    // hardwareAcceleration: 'prefer-hardware',
    // avc: { format: 'annexb' }
}

console.log('⚙️ Encoder configuration:', encoderConfig);

const webmWriterConfig = {
    ...hdConstraints,
    codec: 'VP8',
    width: encoderConfig.width,
    height: encoderConfig.height,
    bitrate: encoderConfig.bitrate,
}

console.log('📝 WebM writer configuration:', webmWriterConfig);

const mp4Demuxer = new MP4Demuxer()
const service = new Service({
    url: process.env.NEXT_PUBLIC_ADMIN_URL
})
const videoProcessor = new VideoProcessor({
    mp4Demuxer,
    webMWriter: new WebMWriter(webmWriterConfig),
    service,
})

console.log('✅ Video processor initialized');

onmessage = async ({ data }) => {
    console.log('📥 Received message in worker:', {
        fileType: data.file?.type,
        fileSize: data.file?.size,
        hasCanvas: !!data.canvas
    });

    try {
        const renderFrame = CanvasRenderer.getRenderer(data.canvas)
        console.log('🎨 Canvas renderer created');

        await videoProcessor.start({
            file: data.file,
            renderFrame,
            encoderConfig,
            sendMessage: (message) => {
                console.log('📤 Sending message from worker:', message);
                self.postMessage(message)
            }
        })
    } catch (error) {
        console.error('❌ Worker error:', error);
        self.postMessage({
            status: 'error',
            error: error.message
        });
    }
}

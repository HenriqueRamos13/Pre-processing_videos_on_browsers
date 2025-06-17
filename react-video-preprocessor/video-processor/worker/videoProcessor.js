export default class VideoProcessor {
    #mp4Demuxer
    #webMWriter
    #service
    /**
     *
     * @param {object} options
     * @param {import('./mp4Demuxer.js').default} options.mp4Demuxer
     * @param {import('./../deps/webm-writer2.js').default} options.webMWriter
     * @param {import('./service.js').default} options.service
     */
    constructor({ mp4Demuxer, webMWriter, service }) {
        console.log('🎥 Initializing VideoProcessor');
        this.#mp4Demuxer = mp4Demuxer
        this.#webMWriter = webMWriter
        this.#service = service
    }

    /** @returns {ReadableStream} */
    mp4Decoder(stream) {
        console.log('🎬 Starting MP4 decoding');
        return new ReadableStream({
            start: async (controller) => {
                const decoder = new VideoDecoder({
                    /** @param {VideoFrame} frame */
                    output(frame) {
                        controller.enqueue(frame)
                    },
                    error(e) {
                        console.error('❌ Error in MP4 decoder:', e);
                        controller.error(e)
                    }
                })

                return this.#mp4Demuxer.run(stream,
                    {
                        async onConfig(config) {
                            console.log('⚙️ Decoder configuration:', config);
                            decoder.configure(config)
                        },
                        /** @param {EncodedVideoChunk} chunk */
                        onChunk(chunk) {
                            console.log('📦 Processing chunk:', {
                                type: chunk.type,
                                timestamp: chunk.timestamp,
                                duration: chunk.duration
                            });
                            decoder.decode(chunk)
                        },
                    }
                )
            },
        })
    }

    enconde144p(encoderConfig) {
        console.log('🔄 Starting 144p encoding with config:', encoderConfig);
        let _encoder;
        const readable = new ReadableStream({
            start: async (controller) => {
                const { supported } = await VideoEncoder.isConfigSupported(encoderConfig)
                if (!supported) {
                    const message = 'enconde144p VideoEncoder config not supported!'
                    console.error('❌ Encoder configuration not supported:', encoderConfig);
                    controller.error(message)
                    return;
                }

                console.log('✅ Encoder configuration supported');
                _encoder = new VideoEncoder({
                    /**
                     *
                     * @param {EncodedVideoChunk} frame
                     * @param {EncodedVideoChunkMetadata} config
                     */
                    output: (frame, config) => {
                        if (config.decoderConfig) {
                            console.log('⚙️ New decoder config received');
                            const decoderConfig = {
                                type: 'config',
                                config: config.decoderConfig
                            }
                            controller.enqueue(decoderConfig)
                        }

                        controller.enqueue(frame)
                    },
                    error: (err) => {
                        console.error('❌ VideoEncoder 144p error:', err)
                        controller.error(err)
                    }
                })

                await _encoder.configure(encoderConfig)
                console.log('✅ Encoder configured successfully');
            }
        })

        const writable = new WritableStream({
            async write(frame) {
                _encoder.encode(frame)
                frame.close()
            }
        })

        return {
            readable,
            writable
        }
    }

    renderDecodedFramesAndGetEncodedChunks(renderFrame) {
        console.log('🎨 Setting up frame renderer');
        let _decoder;
        return new TransformStream({
            start: (controller) => {
                _decoder = new VideoDecoder({
                    output(frame) {
                        renderFrame(frame)
                    },
                    error(e) {
                        console.error('❌ Error in frame renderer:', e)
                        controller.error(e)
                    }
                })
            },
            /**
             *
             * @param {EncodedVideoChunk} encodedChunk
             * @param {TransformStreamDefaultController} controller
             */
            async transform(encodedChunk, controller) {
                if (encodedChunk.type === 'config') {
                    console.log('⚙️ Configuring decoder with new config');
                    await _decoder.configure(encodedChunk.config)
                    return;
                }
                _decoder.decode(encodedChunk)

                // need the encoded version to use webM
                controller.enqueue(encodedChunk)
            }
        })
    }

    async start({ file, encoderConfig, renderFrame, sendMessage }) {
        console.log('🎬 Starting video processing:', {
            filename: file.name,
            size: file.size,
            type: file.type
        });

        try {
            const stream = file.stream()
            const fileName = file.name.split('/').pop().replace('.mp4', '')

            // Process the video and collect frames
            await this.mp4Decoder(stream)
                .pipeThrough(this.enconde144p(encoderConfig))
                .pipeThrough(this.renderDecodedFramesAndGetEncodedChunks(renderFrame))
                .pipeTo(new WritableStream({
                    write: (chunk) => {
                        if (chunk.type === 'config') return;
                        this.#webMWriter.addFrame(chunk);
                    },
                    close: async () => {
                        console.log('✅ Finished processing video frames');
                    }
                }));

            // Get the WebM data
            const webMBlob = await this.#webMWriter.complete();
            console.log('✅ WebM file created:', {
                size: webMBlob.size,
                type: webMBlob.type
            });

            // Convert blob to array buffer for sending
            const arrayBuffer = await webMBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Send to main thread
            sendMessage({
                status: 'done',
                buffers: [uint8Array],
                filename: fileName.concat('-144p.webm')
            });

            // Handle upload
            await this.#service.uploadFile({
                filename: `${fileName}-144p.webm`,
                fileBuffer: webMBlob
            });

            console.log('✅ Video processing and upload completed successfully');

        } catch (error) {
            console.error('❌ Error in video processing:', error);
            sendMessage({
                status: 'error',
                error: error.message || 'Unknown error during video processing'
            });
        }
    }
}

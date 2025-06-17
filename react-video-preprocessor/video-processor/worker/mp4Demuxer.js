import { createFile, DataStream } from '../deps/mp4box.0.5.2.js'

export default class MP4Demuxer {
    #onConfig
    #onChunk
    #file
    /**
     *
     * @param {ReadableStream} stream
     * @param {object} options
     * @param {(config: object) => void} options.onConfig
     *
     * @returns {Promise<void>}
     */

    async run(stream, { onConfig, onChunk }) {
        console.log('🎬 Starting MP4 demuxing');
        this.#onConfig = onConfig
        this.#onChunk = onChunk

        this.#file = createFile()
        this.#file.onReady = this.#onReady.bind(this)
        this.#file.onSamples = this.#onSamples.bind(this)
        this.#file.onError = (error) => {
            console.error('❌ MP4Demuxer error:', error)
        }

        return this.#init(stream)
    }
    #description({ id }) {
        console.log('📝 Getting track description for ID:', id);
        const track = this.#file.getTrackById(id);
        for (const entry of track.mdia.minf.stbl.stsd.entries) {
            const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
            if (box) {
                console.log('✅ Found codec box:', box.constructor.name);
                const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
                box.write(stream);
                return new Uint8Array(stream.buffer, 8);  // Remove the box header.
            }
        }
        console.error('❌ No codec configuration box found');
        throw new Error("avcC, hvcC, vpcC, or av1C box not found");
    }

    #onSamples(track_id, ref, samples) {
        console.log(`📦 Processing ${samples.length} samples for track ${track_id}`);
        // Generate and emit an EncodedVideoChunk for each demuxed sample.
        for (const sample of samples) {
            console.log('🎬 Sample:', {
                type: sample.is_sync ? "key" : "delta",
                timestamp: 1e6 * sample.cts / sample.timescale,
                duration: 1e6 * sample.duration / sample.timescale
            });

            this.#onChunk(new EncodedVideoChunk({
                type: sample.is_sync ? "key" : "delta",
                timestamp: 1e6 * sample.cts / sample.timescale,
                duration: 1e6 * sample.duration / sample.timescale,
                data: sample.data
            }));
        }
    }
    #onReady(info) {
        console.log('✅ MP4 file ready:', {
            duration: info.duration,
            timescale: info.timescale,
            videoTracks: info.videoTracks.length
        });

        const [track] = info.videoTracks
        console.log('🎥 Video track info:', {
            codec: track.codec,
            width: track.video.width,
            height: track.video.height
        });

        this.#onConfig({
            codec: track.codec,
            codedHeight: track.video.height,
            codedWidth: track.video.width,
            description: this.#description(track),
            durationSecs: info.duration / info.timescale,
        })

        this.#file.setExtractionOptions(track.id)
        this.#file.start()
        console.log('🎬 Started MP4 extraction');
    }
    /**
     *
     * @param {ReadableStream} stream
     * @returns Promise<void>
     */
    #init(stream) {
        console.log('🔄 Initializing MP4 stream processing');
        let _offset = 0
        const consumeFile = new WritableStream({
            /** @param {Uint8Array} chunk */
            write: (chunk) => {
                const copy = chunk.buffer
                copy.fileStart = _offset
                this.#file.appendBuffer(copy)

                _offset += chunk.length
                console.log(`📊 Processed ${_offset} bytes`);
            },
            close: () => {
                console.log('✅ MP4 stream processing complete');
                this.#file.flush();
            }
        })

        return stream.pipeTo(consumeFile)
    }
}

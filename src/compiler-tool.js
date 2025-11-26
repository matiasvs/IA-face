import { Compiler } from 'mind-ar/src/image-target/compiler.js';

export class CompilerTool {
    constructor() {
        this.compiler = new Compiler();
        this.images = [];
        this.compiledData = null;
    }

    /**
     * Add images to compile
     * @param {File[]} files - Array of image files
     */
    addImages(files) {
        this.images = Array.from(files).filter(file =>
            file.type === 'image/png' || file.type === 'image/jpeg'
        );
        return this.images;
    }

    /**
     * Compile images to MindAR target data
     * @param {Function} onProgress - Progress callback (0-100)
     * @returns {Promise<ArrayBuffer>} Compiled data
     */
    async compile(onProgress) {
        if (this.images.length === 0) {
            throw new Error('No images to compile');
        }

        console.log(`🔧 Starting compilation of ${this.images.length} image(s)...`);

        try {
            // Convert File objects to HTMLImageElement
            const imageElements = await Promise.all(
                this.images.map(file => {
                    return new Promise((resolve, reject) => {
                        const img = new Image();
                        img.onload = () => resolve(img);
                        img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
                        img.src = URL.createObjectURL(file);
                    });
                })
            );

            console.log(`✅ Loaded ${imageElements.length} image element(s)`);

            // Compile images
            const dataList = await this.compiler.compileImageTargets(
                imageElements,
                (progress) => {
                    const percentage = Math.round(progress * 100);
                    console.log(`📊 Compilation progress: ${percentage}%`);
                    if (onProgress) onProgress(percentage);
                }
            );

            console.log('✅ Compilation complete!');

            // Clean up object URLs
            imageElements.forEach(img => URL.revokeObjectURL(img.src));

            // Export to binary format
            this.compiledData = this.compiler.exportData();

            return this.compiledData;
        } catch (error) {
            console.error('❌ Compilation error:', error);
            throw error;
        }
    }

    /**
     * Download compiled data as .mind file
     * @param {string} filename - Name for the downloaded file
     */
    downloadMindFile(filename = 'targets.mind') {
        if (!this.compiledData) {
            throw new Error('No compiled data available. Run compile() first.');
        }

        // Create blob from compiled data
        const blob = new Blob([this.compiledData], { type: 'application/octet-stream' });

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Cleanup
        URL.revokeObjectURL(url);

        console.log(`💾 Downloaded: ${filename}`);
    }

    /**
     * Reset compiler state
     */
    reset() {
        this.images = [];
        this.compiledData = null;
        console.log('🔄 Compiler reset');
    }

    /**
     * Get image preview URLs
     * @returns {Promise<string[]>} Array of data URLs
     */
    async getImagePreviews() {
        const previews = await Promise.all(
            this.images.map(file => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            })
        );
        return previews;
    }
}

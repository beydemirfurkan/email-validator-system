interface QueueStatus {
    totalProcessing: number;
    jobs: Array<{
        id: string;
        type: string;
        filename: string;
        startTime: Date;
    }>;
}
export declare class BackgroundProcessor {
    private readonly emailValidator;
    private readonly processingQueue;
    constructor();
    processCSVFile(filePath: string, originalFilename: string, requestId: string): Promise<void>;
    processExcelFile(filePath: string, originalFilename: string, requestId: string): Promise<void>;
    private validateExcelData;
    private findEmailInExcelRow;
    queueCSVProcessing(filePath: string, originalFilename: string, requestId: string): string;
    queueExcelProcessing(filePath: string, originalFilename: string, requestId: string): string;
    getQueueStatus(): QueueStatus;
}
export declare const backgroundProcessor: BackgroundProcessor;
export {};
//# sourceMappingURL=background-processor.service.d.ts.map
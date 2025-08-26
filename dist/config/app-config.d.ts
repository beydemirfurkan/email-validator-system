export declare const appConfig: {
    readonly server: {
        readonly port: number;
        readonly jsonLimit: "50mb";
        readonly urlencodedLimit: "50mb";
    };
    readonly validation: {
        readonly batchSize: 10;
    };
    readonly upload: {
        readonly tempDir: "temp/";
        readonly maxFileSize: number;
        readonly allowedTypes: readonly ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
        readonly allowedExtensions: readonly [".csv", ".xls", ".xlsx"];
    };
    readonly csv: {
        readonly emailColumns: readonly ["email", "Email", "EMAIL", "e-mail", "E-mail", "mail"];
    };
    readonly cors: {
        readonly origin: "*";
        readonly headers: "Origin, X-Requested-With, Content-Type, Accept";
        readonly methods: "GET, POST, OPTIONS";
    };
    readonly database: {
        readonly url: string;
    };
};
//# sourceMappingURL=app-config.d.ts.map
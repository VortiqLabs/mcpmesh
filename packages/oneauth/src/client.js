export class OneAuthClient {
    config;
    constructor(config) {
        this.config = config;
    }
    get issuer() {
        return this.config.issuer;
    }
}
//# sourceMappingURL=client.js.map
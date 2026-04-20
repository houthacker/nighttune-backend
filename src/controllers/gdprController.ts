import { GDPRUserData } from '@models/gdpr.js'
import { SqliteDao } from '@dao/sqlite.js'


export class GDPRController {

    private readonly sqlite: SqliteDao

    constructor(sqlite: SqliteDao) {
        this.sqlite = sqlite
    }

    retrieveData(url: URL): GDPRUserData {
        return this.sqlite.retrieveGDPRData(url)
    }

    removeData(url: URL): GDPRUserData {
        return this.sqlite.deleteAllGDPRData(url)
    }
}
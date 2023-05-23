import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import matter from 'gray-matter'
import slugify from "slugify"
import encryption from "./encryption.mjs" 

const entities = {
    feed: {},
    key: {},
    tag: {},
    score: {},
    ref: {},
    rel: {},
    document: {},
    account: {},
}
const utils = {
    toArray(value) {
        if (null == value) {
            return []
        }
        if (Array.isArray(value)) {
            return value
        }
        return [value]
    },
    async boot() {
        const files = utils.fs.readdir(path.join(".","/","source"))
        const raw = await Promise.all(files.map(v => utils.fs.read(v)))
        for (const obj of raw) {
            utils.parse(obj)
        }
        for (const accountID in entities.account) {
            const account = entities.account[accountID]
            const dataset = {
                feed: {},
                tag: {},
                score: {},
                ref: {},
                rel: {},
            }
            dataset.account = {
                id: account.id,
                name: account.name,
            }
            dataset.files = {}
            for (const documentID in entities.document) {
                if (documentID.length > 0 && documentID[0] == '#') {
                    continue
                }

                const document = entities.document[documentID]
                if (undefined !== entities.key[documentID]) {
                    const mx = entities.key[documentID].filter(v => account.keys.includes(v));
                    if (mx.length === 0) {
                        // page is known yet not accessible
                        dataset.files[documentID] = {
                            id: documentID,
                            mode: 403,
                            name: document.name,
                            title: document.title,
                            image: undefined,
                            background: undefined,
                            created_at: document.created_at,
                            content: undefined,
                            excerpt: document.excerpt,
                            keys: entities.key[documentID],
                        }
                        continue
                    }
                }
                for (const v of ["feed","tag","ref","rel"]) {
                    dataset[v] = {}
                    for (const vID in entities[v]) {
                        dataset[v][vID] = []
                        for (const vVal of entities[v][vID]) {
                            if (undefined !== dataset.files[vVal]) {
                                dataset[v][vID].push(vVal)
                            }
                        }
                    }
                }
                for (const vID in entities.score) {
                    dataset.score[vID] = {}
                    for (const vVal in entities.score[vID]) {
                        if (undefined !== dataset.files[vVal]) {
                            dataset.score[vID][vVal] = entities.score[vID][vVal]
                        }
                    }
                }
                dataset.files[documentID] = document
            }
            const rawJson = JSON.stringify(dataset)
            const cryptoJson = encryption.encryptString(rawJson, `${account.password}`)
            const cryptoID = encryption.hashPassword(account.id, account.password, "1.0")
            const cryptoPath = path.join(".","/","public","/","db","/",cryptoID + ".dat")
            fs.writeFileSync(cryptoPath, cryptoJson)
            console.log("OK:", cryptoPath)
        }
    },
    parse(obj) {
        if (obj.ext == ".yaml" || obj.ext == ".yml") {
            if (undefined !== obj.data) {
                if (Array.isArray(obj.data)) {
                    for (const idx in obj.data) {
                        const sobj = obj.data[idx]
                        utils.parse({
                            name: sobj.id || obj.name,
                            ext: ".md",
                            path: obj.path,
                            data: sobj,
                        })
                    }
                } else {
                    console.warn('SKIP: Unsupported schema', obj.path, obj.name)
                }
            } 
        } else if (".md" == obj.ext) {
            let id = obj.name
            if (undefined !== obj.data.id) {
                id = obj.data.id
            }
            if (id == "_" && undefined !== obj.data.name) {
                id = slugify(obj.data.name).toLowerCase().replace(/[\.\'"`]/,'')
            }
            let type = "document"
            if (undefined !== obj.data.type) {
                type = obj.data.type
            }
            if (undefined === entities[type]) {
                entities[type] = {}
            }
            if (undefined !== entities[type][id]) {
                console.warn("SKIP: Document ID is already taken", id, obj.path, obj.name)
                return
            }
            switch (type) {
                case "document": utils.parseDocument(id, obj); return;
                case "account": utils.parseAccount(id, obj); return;
            }      
        }
    },
    parseAccount(id, obj) {
        obj.id = id

        entities.account[id] = {
            id: obj.id,
            name: obj.data.name,
            password: obj.data.password,
            keys: utils.toArray(obj.data.keys),
            menus: obj.data.menus,
        }
    },
    parseDocument(id, obj) {
        // obj.data{content, isEmpty, excerpt, keys, name, feeds, created_at, id, mode, scores, background, image, tags, rels, title}
        obj.id = id

        // obj.data.feeds array|string<id>
        if (obj.data.feeds !== undefined) {
            for (const feedID of utils.toArray(obj.data.feeds)) {
                if (undefined === entities.feed[feedID]) {
                    entities.feed[feedID] = []
                }
                entities.feed[feedID].push(id)
            }
        }

        // obj.data.keys array|string<id> (authorization data)
        if (obj.data.keys !== undefined) {
            for (const keyID of utils.toArray(obj.data.keys)) {
                if (undefined === entities.key[keyID]) {
                    entities.key[id] = []
                }
                entities.key[id].push(keyID)
            }
        } else {
            const keyID = "draft"
            if (undefined === entities.key[keyID]) {
                entities.key[id] = []
            }
            entities.key[id].push(keyID)
        }

        // obj.data.tags array|string<id>
        if (obj.data.tags !== undefined) {
            for (const tagID of utils.toArray(obj.data.tags)) {
                if (undefined === entities.tag[tagID]) {
                    entities.tag[tagID] = []
                }
                entities.tag[tagID].push(id)
            }
        }

        // obj.data.rels array|string<id>
        if (obj.data.rels !== undefined) {
            for (const relID of utils.toArray(obj.data.rels)) {
                if (undefined === entities.rel[relID]) {
                    entities.rel[relID] = []
                }
                entities.rel[relID].push(id)
            }
        }

        // obj.data.refs array|string<id>
        if (obj.data.refs !== undefined) {
            for (const refID of utils.toArray(obj.data.refs)) {
                if (undefined === entities.ref[refID]) {
                    entities.ref[id] = []
                }
                entities.ref[id].push(refID)
            }
        }
        if (typeof obj.data.content === 'string' || obj.data.content instanceof String) {
            const matches = obj.data.content.matchAll(/#\/([A-z0-9-_+:]+)/g)
            for (const match of matches) {
                const refID = match[1]
                if (undefined === entities.ref[id]) {
                    entities.ref[id] = []
                }
                entities.ref[id].push(refID)
            }
        }

        // obj.data.scores array|string<id, value>
        if (obj.data.scores !== undefined) {
            for (const scoreID in obj.data.scores) {
                const score = obj.data.scores[scoreID]
                if (undefined === entities.score[scoreID]) {
                    entities.score[scoreID] = {}
                }
                entities.score[scoreID][id] = score
            }
        }

        entities.document[id] = {
            id: id,
            mode: obj.data.mode,
            name: obj.data.name,
            title: obj.data.title,
            image: obj.data.image,
            background: obj.data.background,
            created_at: obj.data.created_at,
            content: obj.data.content,
            excerpt: obj.data.excerpt,
        }
    },
    fs: {
        readdir(dirPath, arrayOfFiles = []) {
            const files = fs.readdirSync(dirPath)
            arrayOfFiles = arrayOfFiles || []
            files.forEach(function(file) {
              const ext = path.extname(file)
              const prettyPath = path.join(dirPath, "/", file).replace(/\\/g,"/")
              if (fs.statSync(dirPath + "/" + file).isDirectory()) {
                arrayOfFiles = utils.fs.readdir(dirPath + "/" + file, arrayOfFiles)
              } else if(ext == ".yaml" || ext == ".yml" || ext == ".md") {
                arrayOfFiles.push(prettyPath)
              } else {
                console.warn("SKIP: Unsupported extension", prettyPath)
              }
            })
            return arrayOfFiles
        },
        async read(fileName) {
            const ext = path.extname(fileName)
            let content = fs.readFileSync(fileName, 'utf8')
            if (ext === ".yaml" || ext == ".yml") {
                content = yaml.load(content)
            } else if (ext === ".md") {
                const mt = matter(content)
                if (undefined !== mt.data) {
                    for (const v in mt.data) {
                        mt[v] = mt.data[v]
                    }
                    delete mt.data
                }
                content = mt
            }
            return {
                name: path.parse(path.basename(fileName)).name,
                ext: ext,
                path: fileName,
                data: content,
            }
        }
    },
}

await utils.boot()
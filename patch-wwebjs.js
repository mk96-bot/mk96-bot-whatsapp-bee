'use strict';

// WhatsApp Web renombró el campo interno `_serialized` de las claves de mensaje a `$1`.
// whatsapp-web.js 1.34.7 sigue leyendo `_serialized`, obtiene undefined, y termina
// llamando a IndexedDB con una clave undefined, lo que lanza:
// "DataError: Failed to execute 'get' on 'IDBObjectStore': No key or key range specified."
// Esto hacía que la mayoría de nuestros chats 1:1 (586 en total, solo 51 sobrevivían)
// fallaran al serializarse dentro de getChatModel(), y por tanto no aparecían en
// client.getChats(). Parche basado en el fix comunitario del issue #201845 de
// wwebjs/whatsapp-web.js (PR #201850): tolerar ambos nombres de campo, y no dejar que
// un fallo puntual (metadata de grupo, último mensaje) tire todo el chat.
const fs = require('fs');

const filePath = 'node_modules/whatsapp-web.js/src/util/Injected/Utils.js';
let content = fs.readFileSync(filePath, 'utf8');

function applyReplacement(label, before, after) {
  if (!content.includes(before)) {
    throw new Error(`Patch target not found (${label}), whatsapp-web.js source may have changed`);
  }
  content = content.replace(before, after);
}

applyReplacement(
  'getChats: Promise.all -> allSettled',
  `        return await Promise.all(chatPromises);`,
  `        return (await Promise.allSettled(chatPromises)).filter((r) => r.status === 'fulfilled').map((r) => r.value);`,
);

applyReplacement(
  'getChatModel: define getMsgKeyId helper before use',
  `    window.WWebJS.getChatModel = async (chat, { isChannel = false } = {}) => {`,
  `    window.WWebJS.getMsgKeyId = (key) => key?._serialized ?? key?.$1 ?? undefined;

    window.WWebJS.getChatModel = async (chat, { isChannel = false } = {}) => {`,
);

applyReplacement(
  'getChatModel: tolerate missing group metadata',
  `            await groupMetadata.update(chatWid);`,
  `            try {
                await groupMetadata.update(chatWid);
            } catch {
                model.groupMetadata = null;
            }`,
);

applyReplacement(
  'getChatModel: resolve lastMessage via getMsgKeyId instead of raw _serialized',
  `            const lastMessage = chat.lastReceivedKey
                ? window
                      .require('WAWebCollections')
                      .Msg.get(chat.lastReceivedKey._serialized) ||
                  (
                      await window
                          .require('WAWebCollections')
                          .Msg.getMessagesById([
                              chat.lastReceivedKey._serialized,
                          ])
                  )?.messages?.[0]
                : null;`,
  `            const lastReceivedKeyId = window.WWebJS.getMsgKeyId(chat.lastReceivedKey);
            const lastMessage = lastReceivedKeyId
                ? window
                      .require('WAWebCollections')
                      .Msg.get(lastReceivedKeyId) ||
                  (
                      await window
                          .require('WAWebCollections')
                          .Msg.getMessagesById([lastReceivedKeyId])
                  )?.messages?.[0]
                : null;`,
);

applyReplacement(
  'getMessageModel: backfill msg.id._serialized when WhatsApp only provides $1',
  `        if (typeof msg.id.remote === 'object') {
            msg.id = Object.assign({}, msg.id, {
                remote: msg.id.remote._serialized,
            });
        }

        delete msg.pendingAckUpdate;`,
  `        if (typeof msg.id.remote === 'object') {
            msg.id = Object.assign({}, msg.id, {
                remote: msg.id.remote._serialized,
            });
        }

        if (!msg.id._serialized) {
            msg.id = Object.assign({}, msg.id, {
                _serialized: window.WWebJS.getMsgKeyId(msg.id),
            });
        }

        delete msg.pendingAckUpdate;`,
);

applyReplacement(
  'editMessage: resolve edited message via getMsgKeyId instead of raw _serialized',
  `        await window
            .require('WAWebSendMessageEditAction')
            .sendMessageEdit(msg, content, internalOptions);
        return window.require('WAWebCollections').Msg.get(msg.id._serialized);`,
  `        await window
            .require('WAWebSendMessageEditAction')
            .sendMessageEdit(msg, content, internalOptions);
        const editedMsgKeyId = window.WWebJS.getMsgKeyId(msg.id);
        return (
            window.require('WAWebCollections').Msg.get(editedMsgKeyId) ||
            (
                await window
                    .require('WAWebCollections')
                    .Msg.getMessagesById([editedMsgKeyId])
            )?.messages?.[0]
        );`,
);

applyReplacement(
  'sendMessage: resolve sent message via getMsgKeyId instead of raw _serialized',
  `        const [msgPromise, sendMsgResultPromise] = window
            .require('WAWebSendMsgChatAction')
            .addAndSendMsgToChat(chat, message);
        await msgPromise;

        if (options.waitUntilMsgSent) await sendMsgResultPromise;

        return window
            .require('WAWebCollections')
            .Msg.get(newMsgKey._serialized);`,
  `        const [msgPromise, sendMsgResultPromise] = window
            .require('WAWebSendMsgChatAction')
            .addAndSendMsgToChat(chat, message);
        await msgPromise;

        if (options.waitUntilMsgSent) await sendMsgResultPromise;

        const newMsgKeyId = window.WWebJS.getMsgKeyId(newMsgKey);
        return (
            window.require('WAWebCollections').Msg.get(newMsgKeyId) ||
            (
                await window
                    .require('WAWebCollections')
                    .Msg.getMessagesById([newMsgKeyId])
            )?.messages?.[0]
        );`,
);

const clientFilePath = 'node_modules/whatsapp-web.js/src/Client.js';
let clientContent = fs.readFileSync(clientFilePath, 'utf8');

function applyClientReplacement(label, before, after) {
  if (!clientContent.includes(before)) {
    throw new Error(`Patch target not found (${label}), whatsapp-web.js source may have changed`);
  }
  clientContent = clientContent.replace(before, after);
}

// El mismo bug de `_serialized`/`$1` hace que el interceptor de votos de encuesta
// (bulkUpsert) no encuentre el `parentMessage`, lo que a su vez hace que
// `new PollVote()`/`new Message(null)` lance una excepción ANTES de que se emita
// el evento `vote_update` (por eso nunca llegaba a nuestro listener), y además
// impide que se llegue a `origFunction.apply(...)`, así que el voto real tampoco
// se llegaba a guardar (por eso `getPollVotes` también devolvía 0 votos).
applyClientReplacement(
  'bulkUpsert poll vote interceptor: tolerate _serialized/$1 rename and never block real vote write',
  `                async (module, origFunction, ...args) => {
                    const votes = await Promise.all(
                        args[0].map(async (vote) => {
                            const msgKey = vote.id;
                            const parentMsgKey = vote.pollUpdateParentKey;
                            const timestamp = vote.t / 1000;
                            const sender = vote.author ?? vote.from;
                            const senderUserJid = sender._serialized;

                            let parentMessage = Msg.get(
                                parentMsgKey._serialized,
                            );
                            if (!parentMessage) {
                                const fetched = await Msg.getMessagesById([
                                    parentMsgKey._serialized,
                                ]);
                                parentMessage = fetched?.messages?.[0] || null;
                            }

                            return {
                                ...vote,
                                msgKey,
                                sender,
                                parentMsgKey,
                                senderUserJid,
                                timestamp,
                                parentMessage,
                            };
                        }),
                    );

                    window.onPollVoteEvent(votes);

                    return origFunction.apply(module, args);
                },`,
  `                async (module, origFunction, ...args) => {
                    const votes = await Promise.all(
                        args[0].map(async (vote) => {
                            const msgKey = vote.id;
                            const parentMsgKey = vote.pollUpdateParentKey;
                            const timestamp = vote.t / 1000;
                            const sender = vote.author ?? vote.from;
                            const senderUserJid = window.WWebJS.getMsgKeyId(sender);
                            const parentMsgKeyId = window.WWebJS.getMsgKeyId(parentMsgKey);

                            let parentMessage = null;
                            try {
                                parentMessage = parentMsgKeyId
                                    ? Msg.get(parentMsgKeyId)
                                    : null;
                                if (!parentMessage && parentMsgKeyId) {
                                    const fetched = await Msg.getMessagesById([
                                        parentMsgKeyId,
                                    ]);
                                    parentMessage = fetched?.messages?.[0] || null;
                                }
                            } catch {
                                parentMessage = null;
                            }

                            return {
                                ...vote,
                                msgKey,
                                sender,
                                parentMsgKey,
                                senderUserJid,
                                timestamp,
                                parentMessage,
                            };
                        }),
                    );

                    try {
                        window.onPollVoteEvent(votes);
                    } catch {
                        // no bloquear el guardado real del voto por un fallo al notificar
                    }

                    return origFunction.apply(module, args);
                },`,
);

// El bot se quedaba en crash-loop indefinido: cada reinicio generaba un QR y
// poco después caía con "Cannot read properties of null (reading 'Socket')"
// (evaluate en Client.inject, ver Client.js:144). Causa raíz (confirmada en el
// propio repo de whatsapp-web.js, PR wwebjs/whatsapp-web.js#201653, fusionado
// en main pero aún sin publicar en npm a fecha de este parche): el listener de
// 'framenavigated' llama a this.inject() en CADA navegación, incluida la de
// iframes internos de WhatsApp Web (no solo el frame principal), sin try/catch.
// Cuando esa reinyección concurrente cae en un frame que aún no tiene los
// módulos internos listos (p.ej. justo tras mostrarse el QR), window.require
// devuelve null, lanza, y al no estar cazado el rechazo revienta el proceso
// Node entero (de ahí el crash-loop). Aplicamos la misma solución que upstream:
// ignorar navegaciones que no sean del frame principal, y no dejar que un fallo
// puntual de una reinyección tumbe el proceso.
applyClientReplacement(
  "framenavigated: ignorar frames que no sean el principal (iframes) y no dejar que un inject() fallido tumbe el proceso",
  `        this.pupPage.on('framenavigated', async (frame) => {
            if (frame.url().includes('post_logout=1') || this.lastLoggedOut) {
                this.emit(Events.DISCONNECTED, 'LOGOUT');
                await this.authStrategy.logout();
                await this.authStrategy.beforeBrowserInitialized();
                await this.authStrategy.afterBrowserInitialized();
                this.lastLoggedOut = false;
            }
            await this.inject();
        });`,
  `        this.pupPage.on('framenavigated', async (frame) => {
            if (frame.parentFrame() !== null) return;
            if (frame.url().includes('post_logout=1') || this.lastLoggedOut) {
                this.emit(Events.DISCONNECTED, 'LOGOUT');
                await this.authStrategy.logout();
                await this.authStrategy.beforeBrowserInitialized();
                await this.authStrategy.afterBrowserInitialized();
                this.lastLoggedOut = false;
            }
            try {
                await this.inject();
            } catch (err) {
                console.error('inject() falló tras framenavigated, se ignora para no tumbar el proceso:', err);
            }
        });`,
);

fs.writeFileSync(clientFilePath, clientContent);
console.log('whatsapp-web.js (Client.js) parcheado correctamente.');

fs.writeFileSync(filePath, content);
console.log('whatsapp-web.js parcheado correctamente.');

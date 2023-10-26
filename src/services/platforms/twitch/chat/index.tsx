import { useMessageListDispatch } from '@/contexts/MessageListContext'
import useChatClient from './useChatClient'
import { useEffect } from 'react'
import type { Listener } from '@d-fischer/typed-event-emitter'
import useMessage from './transforms/useMessage'
import { useClient } from '@/contexts/ClientContext'

export default function ChatHandler() {
  const client = useClient()
  const dispatch = useMessageListDispatch()
  const chatClient = useChatClient()
  const transformMessage = useMessage()

  // -------------------------
  //  Chat Dispatch Functions
  // -------------------------

  function addMessage(message?: Twitch.Event.Message) {
    if (!message) return
    debugLog(message)
    dispatch({ type: 'add', payload: message })
  }

  function clearMessages(userId: string | null = null) {
    dispatch({ type: 'clear', payload: userId })
    client.onModMessageDelete(
      userId ? { type: 'user', id: userId } : { type: 'all', id: null },
    )
  }

  function removeMessage(messageId: string) {
    dispatch({ type: 'remove', payload: messageId })
    client.onModMessageDelete({ type: 'single', id: messageId })
  }

  // -----------------
  //  Event Listeners
  // -----------------

  useEffect(() => {
    const listeners: Listener[] = []
    listeners.push(
      // -----------------------------
      //  Events Using ChatMessage
      // -----------------------------

      chatClient.onMessage(async (_, __, text, msg) => {
        const { bits } = msg
        const typeData: Twitch.Event.Message.Type = bits
          ? { type: 'cheer', cheer: { amount: bits } }
          : { type: 'basic' }

        const message = await transformMessage(typeData, msg, text)
        addMessage(message)
      }),

      chatClient.onAction(async (_, __, text, msg) => {
        const message = await transformMessage({ type: 'action' }, msg, text)
        addMessage(message)
      }),

      // -------------------------
      //  Events Using UserNotice
      // -------------------------

      chatClient.onResub(async (_, __, info, msg) => {
        const typeData: Twitch.Event.Message.Type = {
          type: 'resub',
          resub: { months: info.months, tier: info.plan },
        }

        const message = await transformMessage(typeData, msg)
        addMessage(message)
      }),

      chatClient.onAnnouncement(async (_, __, info, msg) => {
        const typeData: Twitch.Event.Message.Type = {
          type: 'announcement',
          announcement: { color: info.color },
        }

        const message = await transformMessage(typeData, msg)
        addMessage(message)
      }),

      // --------------------------
      //  Events Removing Messages
      // --------------------------

      chatClient.onChatClear(() => {
        clearMessages()
      }),

      chatClient.onTimeout((_, __, ___, msg) => {
        clearMessages(msg.targetUserId)
      }),

      chatClient.onBan((_, __, msg) => {
        clearMessages(msg.targetUserId)
      }),

      chatClient.onMessageRemove((_, messageId) => {
        removeMessage(messageId)
      }),
    )

    return () => {
      listeners.forEach(listener => {
        if (listener) chatClient.removeListener(listener)
      })
    }
  })

  return null
}

function debugLog(message: Twitch.Event.Message) {
  if (import.meta.env.DEV && import.meta.env.MODE === 'debug') {
    console.log(
      `%c[${message.type}] ${message.user.displayName}: ${message.text}`,
      'background-color: black; color: white; padding: 5px 10px; border-radius: 100px; border: 2px solid white',
    )

    console.log('Slime2 Message Data', message)

    console.log(
      `%cMessage ${message.id}`,
      'background-color: black; color: white; padding: 5px 10px; border-radius: 0 0 10px 10px; display: inline-block; margin-bottom: 10px; border: 1px solid gray;',
    )
  }
}
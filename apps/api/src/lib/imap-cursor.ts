/**
 * IMAP Cursor Management
 * Manages the IMAP cursor state using the imap_state table
 */

import { prisma } from './prisma.js';

const MAILBOX = process.env.IMAP_FOLDER || 'INBOX';

export interface ImapCursor {
  lastUid: number;
  uidValidity: number | null;
}

/**
 * Get the current IMAP cursor state
 * @returns Current cursor with lastUid and uidValidity
 */
export async function getCursor(): Promise<ImapCursor> {
  const state = await prisma.imapState.findUnique({
    where: { mailbox: MAILBOX },
  });

  if (!state) {
    return { lastUid: 0, uidValidity: null };
  }

  return {
    lastUid: Number(state.last_uid),
    uidValidity: state.uidvalidity ? Number(state.uidvalidity) : null,
  };
}

/**
 * Save the current IMAP cursor state
 * @param lastUid - Last processed UID
 * @param uidValidity - Current mailbox uidValidity
 */
export async function saveCursor(lastUid: number, uidValidity: number): Promise<void> {
  await prisma.imapState.upsert({
    where: { mailbox: MAILBOX },
    create: {
      mailbox: MAILBOX,
      last_uid: BigInt(lastUid),
      uidvalidity: BigInt(uidValidity),
      last_poll_at: new Date(),
    },
    update: {
      last_uid: BigInt(lastUid),
      uidvalidity: BigInt(uidValidity),
      last_poll_at: new Date(),
    },
  });
}

/**
 * Reset the IMAP cursor (used when uidValidity changes)
 */
export async function resetCursor(): Promise<void> {
  await prisma.imapState.upsert({
    where: { mailbox: MAILBOX },
    create: {
      mailbox: MAILBOX,
      last_uid: BigInt(0),
      uidvalidity: null,
      last_poll_at: new Date(),
    },
    update: {
      last_uid: BigInt(0),
      uidvalidity: null,
      last_poll_at: new Date(),
    },
  });
}

/**
 * Update the last poll timestamp
 */
export async function updateLastPollTime(): Promise<void> {
  await prisma.imapState.upsert({
    where: { mailbox: MAILBOX },
    create: {
      mailbox: MAILBOX,
      last_uid: BigInt(0),
      uidvalidity: null,
      last_poll_at: new Date(),
    },
    update: {
      last_poll_at: new Date(),
    },
  });
}

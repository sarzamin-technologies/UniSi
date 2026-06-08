import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import {
  ownerSessionOptions,
  signerSessionOptions,
  type OwnerSessionData,
  type SignerSessionData,
} from "@unisi/agnic";

export async function getOwnerSession(): Promise<IronSession<OwnerSessionData>> {
  return getIronSession<OwnerSessionData>(cookies(), ownerSessionOptions());
}

export async function getSignerSession(): Promise<IronSession<SignerSessionData>> {
  return getIronSession<SignerSessionData>(cookies(), signerSessionOptions());
}

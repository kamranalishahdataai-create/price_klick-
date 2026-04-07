import React, { createContext, useContext, useEffect, useState } from "react";
import { useConsent } from "../hooks/useBackendExamples";
const UserCtx = createContext(null);
export const useUser = () => useContext(UserCtx);
export default function UserProvider({ children }) {
  const { giveConsent } = useConsent();
  const [userId, setUserId] = useState(() => localStorage.getItem("cf_userId") || null);
  const [email, setEmail] = useState(() => localStorage.getItem("cf_email") || "");
  useEffect(() => { (async () => { if (!userId && email) { const id = await giveConsent(email); localStorage.setItem("cf_userId", id); setUserId(id); } })(); }, []);
  async function ensureUser(nextEmail) { const e = nextEmail || email || "guest@example.com"; const id = await giveConsent(e); localStorage.setItem("cf_userId", id); localStorage.setItem("cf_email", e); setEmail(e); setUserId(id); return id; }
  return (<UserCtx.Provider value={{ userId, email, ensureUser }}>{children}</UserCtx.Provider>);
}

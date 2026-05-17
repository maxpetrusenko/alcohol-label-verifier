import type { Metadata } from "next";
import { VerifierClient } from "./VerifierClient";

export const metadata: Metadata = {
  title: "LabelCheck | TTB COLA Label Verifier",
  description: "Compare alcohol label photos against application facts and TTB-focused review rules.",
};

export default function Home() {
  return <VerifierClient />;
}

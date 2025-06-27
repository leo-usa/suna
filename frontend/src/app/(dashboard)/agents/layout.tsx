import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Conversation | Dobby",
  description: "Interactive agent conversation powered by Dobby",
  openGraph: {
    title: "Agent Conversation | Dobby",
    description: "Interactive agent conversation powered by Dobby",
    type: "website",
  },
};

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 
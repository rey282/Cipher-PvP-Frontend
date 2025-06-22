// src/components/Layout.tsx
import type { ReactNode } from "react";
import Header from "./Header";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4 bg-gray-100">{children}</main>
    </div>
  );
}

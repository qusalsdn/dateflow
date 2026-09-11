import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dateflow | 서울 데이트 코스", template: "%s | Dateflow" },
  description: "가고 싶은 장소에서 시작하는 서울 데이트 코스. 도보와 대중교통으로 하루를 연결하세요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

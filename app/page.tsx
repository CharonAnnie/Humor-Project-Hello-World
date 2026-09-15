import { Courier_Prime } from "next/font/google";

const courierPrime = Courier_Prime({
  weight: "400",
  subsets: ["latin"],
});

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <h1 className={`${courierPrime.className} typewriter text-4xl`}>
        Hello World
      </h1>
    </main>
  );
}

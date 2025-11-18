"use client";

import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Coffee } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ServedPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50 py-10">
      <div className="container max-w-3xl">
        <Card className="border-none shadow-2xl">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow">
              <Image
                src="/thechaicouple.jpg"
                alt="Happy chai lovers"
                width={160}
                height={160}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div className="flex items-center justify-center gap-3">
              <Badge className="bg-emerald-100 text-emerald-900">Order Complete</Badge>
              <Badge variant="outline" className="bg-white/80">
                Pick from the counter
              </Badge>
            </div>
            <CardTitle className="text-4xl font-semibold text-emerald-900">
              Thank you! Your chai is ready.
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Show this screen to the staff, collect your order, and enjoy.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            We’ve cleared your token from the queue. If you’d like another chai or bun,
            feel free to rejoin the queue at any time.
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              size="lg"
              className="bg-emerald-500 text-white hover:bg-emerald-500/90"
            >
              <Link href="/queue">
                <Coffee className="mr-2 h-4 w-4" />
                Order another round
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/">Back to home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}



import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/index.html" });
  },
  head: () => ({
    meta: [
      { title: "ডা. এম. এ. বি. সিদ্দিক | কোলোরেক্টাল ও ক্যান্সার সার্জন" },
      {
        name: "description",
        content:
          "ডা. এম. এ. বি. সিদ্দিক — কোলোরেক্টাল, ল্যাপারোস্কোপিক, ব্রেস্ট ও ক্যান্সার সার্জারি বিশেষজ্ঞ, ঢাকা ও গাজীপুর।",
      },
      { property: "og:title", content: "ডা. এম. এ. বি. সিদ্দিক | কোলোরেক্টাল ও ক্যান্সার সার্জন" },
      {
        property: "og:description",
        content: "কোলোরেক্টাল, ল্যাপারোস্কোপিক ও ক্যান্সার সার্জারিতে অভিজ্ঞ সার্জন। অ্যাপয়েন্টমেন্ট নিন।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});

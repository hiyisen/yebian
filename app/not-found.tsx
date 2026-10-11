import Link from "next/link";

import { OpenSearchButton } from "@/components/OpenSearchButton";

export default function NotFound() {
  return (
    <div className="wrap notfound">
      <div className="notfound__code" aria-hidden="true">
        404
      </div>
      <h1>这一页不在了</h1>
      <p>链接可能已经失效，或者这篇文章我还没写。</p>
      <div className="notfound__actions">
        <Link className="btn" href="/">
          回文章列表
        </Link>
        <OpenSearchButton className="btn-ghost">搜索一下</OpenSearchButton>
      </div>
    </div>
  );
}

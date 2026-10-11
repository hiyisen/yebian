import Link from "next/link";

import { rssPath, site } from "@/lib/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot__grid">
          <div className="foot__about">
            <Link className="brand" href="/">
              <span className="brand__mark" aria-hidden="true">
                <span />
              </span>
              <span>
                <span className="brand__name">{site.name}</span>{" "}
                <span className="brand__latin">{site.latin}</span>
              </span>
            </Link>
            <p>
              一个关于代码、设计与思考的个人笔记站。用 Next.js
              构建，文章以 Markdown 撰写。
            </p>
          </div>

          <div>
            <h4>导航</h4>
            <ul>
              {site.nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
              <li>
                <a href={rssPath}>RSS 订阅</a>
              </li>
            </ul>
          </div>

          <div>
            <h4>在别处</h4>
            <ul>
              {site.social.map((item) => (
                <li key={item.href}>
                  <a href={item.href} rel="me noopener noreferrer" target="_blank">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="foot__bottom">
          <span>
            © {year} {site.title}
          </span>
          <span>Built with Next.js · Typeset with care</span>
        </div>
      </div>
    </footer>
  );
}

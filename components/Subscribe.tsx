import { CopyRssLink } from "./CopyRssLink";

/**
 * 订阅区块。
 * 视觉稿里这里是一个邮箱订阅表单，但本站没有后端也没有邮件列表 ——
 * 与其放一个提交了没反应的假表单，不如给一个真能用的 RSS 入口。
 */
export function Subscribe() {
  return (
    <section className="wrap">
      <div className="subscribe reveal">
        <div>
          <h2>订阅这个博客</h2>
          <p>
            没有邮件列表，也不用注册账号。把 RSS 地址丢进你的阅读器就行——
            我更新什么，你就能看到什么。
          </p>
        </div>
        <div className="subform">
          <a className="btn" href="/rss.xml">
            订阅 RSS
          </a>
          <CopyRssLink />
        </div>
      </div>
    </section>
  );
}

'use client'

import Link from 'next/link'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { ChevronDown } from 'lucide-react'
import { FAQ_ITEMS } from './faqData'
import Reveal from './Reveal'

/** 자주 묻는 질문 — Headless UI Disclosure (키보드/스크린리더 접근성 내장) */
export default function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-16 border-t border-[var(--panel-border)] bg-black/10">
      <div className="max-w-3xl mx-auto px-5 py-24">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="font-outfit font-bold text-3xl sm:text-4xl text-[var(--text-primary)]">
              자주 묻는 질문
            </h2>
            <p className="mt-3 text-[var(--text-secondary)]">
              시작하기 전에 궁금한 것들, 여기 다 있습니다.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((item) => (
              <Disclosure key={item.question} as="div" className="glass-panel overflow-hidden">
                <DisclosureButton className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer focus:outline-none data-[focus]:ring-1 data-[focus]:ring-[var(--accent-primary)]/50 rounded-2xl">
                  <span className="font-bold text-[var(--text-primary)]">{item.question}</span>
                  <ChevronDown className="w-5 h-5 shrink-0 text-[var(--text-secondary)] transition-transform duration-200 group-data-[open]:rotate-180" />
                </DisclosureButton>
                <DisclosurePanel className="px-5 pb-5 text-sm leading-7 text-[var(--text-secondary)]">
                  {item.answer}
                  {item.link && (
                    <>
                      {' '}
                      <Link
                        href={item.link.href}
                        className="text-[var(--accent-primary)] underline underline-offset-2 hover:text-white transition-colors"
                      >
                        {item.link.label} →
                      </Link>
                    </>
                  )}
                </DisclosurePanel>
              </Disclosure>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

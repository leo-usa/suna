'use client';

import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { changeLogData } from "../data/changelog";
import { useTranslation } from 'react-i18next';

export type ChangelogData = {
  version: string;
  date: string;
  title: string;
  description: string;
  items?: string[];
  image?: string;
  button?: {
    url: string;
    text: string;
  };
};

export interface Changelog1Props {
  title?: string;
  description?: string;
  data?: ChangelogData[];
  className?: string;
}

export const Changelog = ({
  title = 'changelog.title',
  description = 'changelog.description',
  data = changeLogData,
}: Changelog1Props) => {
  const { t } = useTranslation();
  return (
    <section id="changelog" className="py-32 px-10 lg:px-0">
      <div className="container">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">
            {t(title)}
          </h1>
          <p className="mb-6 text-base text-muted-foreground md:text-lg">
            {t(description)}
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-3xl space-y-16 md:mt-24 md:space-y-24">
          {data.map((entry, index) => (
            <div
              key={index}
              className="relative flex flex-col gap-4 md:flex-row md:gap-16"
            >
              <div className="top-30 flex h-min w-64 shrink-0 items-center gap-4 md:sticky">
                <Badge className="text-xs">
                  {entry.version}
                </Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  {t(entry.date)}
                </span>
              </div>
              <div className="flex flex-col">
                <h2 className="mb-3 text-lg leading-tight font-bold text-foreground/90 md:text-2xl">
                  {t(entry.title)}
                </h2>
                <p className="text-sm text-muted-foreground md:text-base">
                  {t(entry.description)}
                </p>
                {entry.items && entry.items.length > 0 && (
                  <ul className="mt-4 ml-4 space-y-1.5 text-sm text-muted-foreground md:text-base">
                    {entry.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="list-disc">
                        {t(item)}
                      </li>
                    ))}
                  </ul>
                )}
                {entry.image && (
                  <img
                    src={entry.image}
                    alt={`${entry.version} visual`}
                    className="mt-8 w-full rounded-lg object-cover"
                  />
                )}
                {entry.button && (
                  <Button variant="link" className="mt-4 self-end" asChild>
                    <a href={entry.button.url} target="_blank">
                      {t(entry.button.text)} <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

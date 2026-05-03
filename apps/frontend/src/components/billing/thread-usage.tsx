'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  AlertCircle,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import { useThreadUsage } from '@/hooks/billing/use-thread-usage';
import { formatCredits } from '@agentpress/shared';
import { useTranslations, useLocale } from 'next-intl';
import { enUS, zhCN, de, fr, it, ja, pt, es } from 'date-fns/locale';
import type { Locale as DateFnsLocale } from 'date-fns';

const DATE_FNS_LOCALES: Record<string, DateFnsLocale> = {
  en: enUS,
  zh: zhCN,
  de,
  fr,
  it,
  ja,
  pt,
  es,
};

export default function ThreadUsage() {
  const t = useTranslations('billing.threadUsageDetail');
  const tBill = useTranslations('billing');
  const tCommon = useTranslations('common');
  const dateLocale = DATE_FNS_LOCALES[useLocale()] ?? enUS;
  const [offset, setOffset] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 29)),
    to: new Date(),
  });
  const limit = 50;

  const { data, isLoading, error } = useThreadUsage({
    limit,
    offset,
    startDate: dateRange?.from,
    endDate: dateRange?.to,
  });

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'PPp', { locale: dateLocale });
  };

  const formatRangeLabel = (from: Date, to: Date) =>
    `${format(from, 'PP', { locale: dateLocale })} - ${format(to, 'PP', { locale: dateLocale })}`;

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNextPage = () => {
    if (data?.pagination.has_more) {
      setOffset(offset + limit);
    }
  };

  const handleDateRangeUpdate = (values: { range: DateRange }) => {
    setDateRange(values.range);
    setOffset(0);
  };

  const handleOpenThread = (threadId: string, projectId: string | null) => {
    if (projectId) {
      window.open(`/projects/${projectId}/thread/${threadId}`, '_blank');
    }
  };

  // Show skeleton loader on initial load or during pagination
  const showSkeleton = isLoading && offset === 0;
  const showPaginationSkeleton = isLoading && offset > 0;

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tBill('threadUsage')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{tCommon('error')}</AlertTitle>
            <AlertDescription>
              {error.message || t('loadError')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const threadRecords = data?.thread_usage || [];
  const summary = data?.summary;

  if (showSkeleton) {
    return (
      <div className="space-y-6">
        {summary && (
          <Card className='w-full'>
            <CardHeader className='flex items-center justify-between'>
              <div>
                <CardTitle>{tBill('totalUsage')}</CardTitle>
                <CardDescription className='mt-2'>
                  {dateRange.from && dateRange.to
                    ? formatRangeLabel(dateRange.from, dateRange.to)
                    : t('selectedPeriod')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Skeleton className="h-9 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardHeader>
          </Card>
        )}
        <Card className='p-0 px-0 bg-transparent shadow-none border-none'>
          <CardHeader className='px-0'>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('usageTitle')}</CardTitle>
                <CardDescription className='mt-2'>
                  {t('perConversationSubtitle')}
                </CardDescription>
              </div>
              <Skeleton className="h-10 w-[280px]" />
            </div>
          </CardHeader>
          <CardContent className='px-0'>
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader className='bg-muted/50'>
                  <TableRow>
                    <TableHead>{tBill('thread')}</TableHead>
                    <TableHead className="w-[180px]">{tBill('lastUsed')}</TableHead>
                    <TableHead className="text-right">{tBill('creditsUsed')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-5 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 max-w-full">
      {summary && (
          <Card className='w-full'>
            <CardHeader className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
              <div>
                <CardTitle className="text-base sm:text-lg">{tBill('totalUsage')}</CardTitle>
                <CardDescription className='mt-1 sm:mt-2 text-xs sm:text-sm'>
                  {dateRange.from && dateRange.to
                    ? formatRangeLabel(dateRange.from, dateRange.to)
                    : t('selectedPeriod')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <div className="text-xl sm:text-3xl font-semibold">
                    {formatCredits(summary.total_credits_used)}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t('creditsConsumed')}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
      )}
      <Card className='p-0 px-0 bg-transparent shadow-none border-none'>
        <CardHeader className='px-0'>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg">{t('usageTitle')}</CardTitle>
              <CardDescription className='mt-1 sm:mt-2 text-xs sm:text-sm'>
                {t('perConversationSubtitle')}
              </CardDescription>
            </div>
            <DateRangePicker
              initialDateFrom={dateRange.from}
              initialDateTo={dateRange.to}
              onUpdate={handleDateRangeUpdate}
              align="end"
            />
          </div>
        </CardHeader>
        <CardContent className='px-0'>
          {threadRecords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">
                {dateRange.from && dateRange.to
                  ? t('noUsageInRange', {
                      from: format(dateRange.from, 'PP', { locale: dateLocale }),
                      to: format(dateRange.to, 'PP', { locale: dateLocale }),
                    })
                  : t('noUsage')}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border overflow-x-auto">
                <Table className="min-w-[500px]">
                  <TableHeader className='bg-muted/50'>
                    <TableRow>
                      <TableHead>{tBill('thread')}</TableHead>
                      <TableHead className="w-[180px]">{tBill('lastUsed')}</TableHead>
                      <TableHead className="text-right">{tBill('creditsUsed')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {showPaginationSkeleton ? (
                      // Show skeleton rows during pagination
                      [...Array(5)].map((_, i) => (
                        <TableRow key={`skeleton-${i}`}>
                          <TableCell>
                            <Skeleton className="h-5 w-48" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="h-4 w-20 ml-auto" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      threadRecords.map((record) => (
                        <TableRow 
                          key={record.thread_id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleOpenThread(record.thread_id, record.project_id)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="truncate font-semibold">{record.project_name}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(record.last_used)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCredits(record.credits_used)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {data?.pagination && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t('pagination', {
                      from: offset + 1,
                      to: Math.min(offset + limit, data.pagination.total),
                      total: data.pagination.total,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={offset === 0 || isLoading}
                      className="flex-1 sm:flex-none"
                    >
                      {tCommon('previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!data.pagination.has_more || isLoading}
                      className="flex-1 sm:flex-none"
                    >
                      {tCommon('next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


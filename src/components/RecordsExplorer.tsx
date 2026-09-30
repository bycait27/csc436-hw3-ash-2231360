import { useMemo, useState } from 'react'
import type { ParsedCsv } from '../lib/parseCsv'
import { calculateWorkload } from '../lib/workloadMetrics'
import './RecordsExplorer.css'

interface RecordsExplorerProps {
  dataset: (ParsedCsv & { fileName: string }) | null
}

type ZoneFilter = 'all' | 'North' | 'Central' | 'South'
type StatusFilter = 'all' | 'Open' | 'Closed'
type SortOrder = 'oldest' | 'newest'

function isZoneFilter(value: string): value is ZoneFilter {
  return ['all', 'North', 'Central', 'South'].includes(value)
}

function isStatusFilter(value: string): value is StatusFilter {
  return ['all', 'Open', 'Closed'].includes(value)
}

function isSortOrder(value: string): value is SortOrder {
  return value === 'oldest' || value === 'newest'
}

export function RecordsExplorer({ dataset }: RecordsExplorerProps) {
  const [search, setSearch] = useState('')
  const [zone, setZone] = useState<ZoneFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('oldest')

  const filteredRows = useMemo(() => {
    if (!dataset) return []

    const columnIndex = new Map(
      dataset.headers.map((header, index) => [header, index]),
    )
    const value = (row: string[], column: string) =>
      row[columnIndex.get(column) ?? -1] ?? ''
    const normalizedSearch = search.trim().toLocaleLowerCase()

    return dataset.rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        const matchesSearch =
          normalizedSearch === '' ||
          value(row, 'ticket_id').toLocaleLowerCase().includes(normalizedSearch) ||
          value(row, 'summary').toLocaleLowerCase().includes(normalizedSearch)
        const matchesZone = zone === 'all' || value(row, 'zone') === zone
        const rowStatus = value(row, 'closed_on') === '' ? 'Open' : 'Closed'
        const matchesStatus = status === 'all' || rowStatus === status

        return matchesSearch && matchesZone && matchesStatus
      })
      .sort((first, second) => {
        const firstDate = value(first.row, 'opened_on')
        const secondDate = value(second.row, 'opened_on')
        const dateOrder = firstDate.localeCompare(secondDate)

        return (sortOrder === 'oldest' ? dateOrder : -dateOrder) ||
          first.index - second.index
      })
  }, [dataset, search, sortOrder, status, zone])

  const workload = useMemo(
    () => calculateWorkload(dataset?.headers ?? [], filteredRows.map(({ row }) => row)),
    [dataset, filteredRows],
  )
  const zoneWorkloads = useMemo(
    () =>
      (['North', 'Central', 'South'] as const).map((zoneName) => ({
        zone: zoneName,
        metrics: calculateWorkload(
          dataset?.headers ?? [],
          filteredRows
            .filter(({ row }) => {
              const zoneIndex = dataset?.headers.indexOf('zone') ?? -1
              return (row[zoneIndex] ?? '') === zoneName
            })
            .map(({ row }) => row),
        ),
      })),
    [dataset, filteredRows],
  )

  function resetFilters() {
    setSearch('')
    setZone('all')
    setStatus('all')
    setSortOrder('oldest')
  }

  if (dataset) {
    return (
      <section className="records-explorer" aria-labelledby="records-explorer-title">
        <div className="records-explorer__heading">
          <h2 id="records-explorer-title">Explore the records</h2>
          <button
            className="records-explorer__reset"
            type="button"
            onClick={resetFilters}
          >
            Reset filters
          </button>
        </div>

        <div className="records-explorer__filters">
          <label className="records-explorer__field records-explorer__search">
            <span>Search ID or summary</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. inspection"
            />
          </label>

          <label className="records-explorer__field">
            <span>Zone</span>
            <select
              value={zone}
              onChange={(event) => {
                if (isZoneFilter(event.target.value)) setZone(event.target.value)
              }}
            >
              <option value="all">All zones</option>
              <option value="North">North</option>
              <option value="Central">Central</option>
              <option value="South">South</option>
            </select>
          </label>

          <label className="records-explorer__field">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => {
                if (isStatusFilter(event.target.value)) {
                  setStatus(event.target.value)
                }
              }}
            >
              <option value="all">All statuses</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </label>

          <label className="records-explorer__field">
            <span>Sort by</span>
            <select
              value={sortOrder}
              onChange={(event) => {
                if (isSortOrder(event.target.value)) {
                  setSortOrder(event.target.value)
                }
              }}
            >
              <option value="oldest">Oldest opening first</option>
              <option value="newest">Newest opening first</option>
            </select>
          </label>
        </div>

        <section
          className="records-explorer__workload"
          aria-labelledby="records-explorer-workload-title"
        >
          <h3 id="records-explorer-workload-title">Matching workload</h3>
          <p className="records-explorer__intro">
            All matching records, not just the displayed page. Reference date:
            {' '}2026-04-01 (UTC).
          </p>
          <dl className="records-explorer__metrics">
            <div>
              <dt>Matching tickets</dt>
              <dd>{workload.matchingTickets.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Open tickets</dt>
              <dd>{workload.openTickets.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Overdue open</dt>
              <dd>{workload.overdueOpen.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Known open hours</dt>
              <dd>{workload.knownOpenHours.toLocaleString()}</dd>
            </div>
          </dl>
          <p className="records-explorer__coverage">
            {workload.knownOpenCount} of {workload.openTickets} open tickets estimated;{' '}
            {workload.unknownOpenCount} unknown.
          </p>
          <p className="records-explorer__zone-caption">
            Compare zones within the current filters
          </p>
          <div className="records-explorer__zone-table-wrap">
            <table className="records-explorer__zone-table">
              <thead>
                <tr>
                  <th scope="col">Zone</th>
                  <th scope="col">Matching</th>
                  <th scope="col">Open</th>
                  <th scope="col">Overdue open</th>
                  <th scope="col">Known hours</th>
                  <th scope="col">Estimate coverage</th>
                </tr>
              </thead>
              <tbody>
                {zoneWorkloads.map(({ zone: zoneName, metrics }) => (
                  <tr key={zoneName}>
                    <th scope="row">{zoneName}</th>
                    <td>{metrics.matchingTickets.toLocaleString()}</td>
                    <td>{metrics.openTickets.toLocaleString()}</td>
                    <td>{metrics.overdueOpen.toLocaleString()}</td>
                    <td>{metrics.knownOpenHours.toLocaleString()}</td>
                    <td>
                      {metrics.knownOpenCount} of {metrics.openTickets} open tickets estimated;{' '}
                      {metrics.unknownOpenCount} unknown.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="records-explorer__zone-note">
            Overdue means open for at least 14 days. Ticket counts are not
            population-adjusted incident rates.
          </p>
        </section>

        <p className="records-explorer__count" aria-live="polite">
          Showing {filteredRows.length} of {dataset.rows.length} records
        </p>

        <div className="records-explorer__table-wrap">
          <table>
            <thead>
              <tr>
                {dataset.headers.map((header) => (
                  <th key={header} scope="col">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ row, index }) => (
                <tr key={`${row[0] ?? 'record'}-${index}`}>
                  {dataset.headers.map((header, columnIndex) => (
                    <td key={`${header}-${columnIndex}`}>{row[columnIndex] ?? ''}</td>
                  ))}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={dataset.headers.length}>
                    No records match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  return (
    <section
      className="records-explorer-empty"
      aria-labelledby="records-explorer-title"
    >
      <h2 id="records-explorer-title">
        Start with the evidence, not a guess.
      </h2>
      <p>
        Choose a supplied CSV to compare open tickets, overdue work, and
        estimate coverage. The import report will explain any records that
        cannot be used.
      </p>
    </section>
  )
}

export default RecordsExplorer

@empty(!$title)
    <div class="rx-tbl-section__head">
        <h3 class="rx-tbl-section__title">{{ $title }}</h3>
    </div>
@endempty

<div class="rx-admin-table-panel mb-3"
     data-controller="table"
     data-table-slug="{{ $slug }}"
>
    <div class="table-responsive rx-admin-table-wrap">
        <table @class([
            'table',
            'rx-admin-table',
            'table-compact' => $compact,
            'table-striped' => $striped,
            'table-bordered' => $bordered,
            'table-hover' => $hoverable,
        ])>
            @if($showHeader)
                <thead>
                    <tr>
                        @foreach($columns as $column)
                            {!! $column->buildTh() !!}
                        @endforeach
                    </tr>
                </thead>
            @endif

            <tbody>
                @foreach($rows as $source)
                    <tr class="rx-admin-table__row">
                        @foreach($columns as $column)
                            {!! $column->buildTd($source, $loop->parent) !!}
                        @endforeach
                    </tr>
                @endforeach

                @if($total->isNotEmpty() && $rows->isNotEmpty())
                    <tr class="rx-admin-table__total">
                        @foreach($total as $column)
                            {!! $column->buildTd($repository, $loop) !!}
                        @endforeach
                    </tr>
                @endif
            </tbody>
        </table>
    </div>

    @if($rows->isEmpty())
        <div class="rx-admin-table-empty">
            @isset($iconNotFound)
                <x-orchid-icon :path="$iconNotFound" class="rx-admin-table-empty__icon"/>
            @endisset
            <h3 class="rx-admin-table-empty__title">{!! $textNotFound !!}</h3>
            {!! $subNotFound !!}
        </div>
    @else
        <div class="rx-admin-table-footer">
            @include('platform::layouts.pagination', [
                'paginator' => $rows,
                'columns' => $columns,
                'onEachSide' => $onEachSide,
            ])
        </div>
    @endif
</div>

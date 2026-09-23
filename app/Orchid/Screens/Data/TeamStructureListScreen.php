<?php



declare(strict_types=1);



namespace App\Orchid\Screens\Data;



use App\Models\User;

use App\Orchid\Concerns\RequiresPlatformDataPermission;

use App\Orchid\Layouts\Data\TeamStructureListLayout;

use App\Support\MemberCode;

use Illuminate\Http\RedirectResponse;

use Illuminate\Http\Request;

use Orchid\Screen\Screen;

use Orchid\Support\Facades\Toast;



class TeamStructureListScreen extends Screen

{

    use RequiresPlatformDataPermission;



    public function query(): iterable

    {

        return [

            'members' => User::query()

                ->with([

                    'referrer:id,name,email,member_number,referral_code,level',

                ])

                ->withCount('referrals as direct_team_count')

                ->defaultSort('id', 'desc')

                ->paginate(30),

        ];

    }



    public function name(): ?string

    {

        return __('Team structure');

    }



    public function description(): ?string

    {

        return __('Who sponsored whom (referral level plan), member level, and direct team size.');

    }



    public function layout(): iterable

    {

        return [

            TeamStructureListLayout::class,

        ];

    }



    public function disableWithdrawals(Request $request): RedirectResponse

    {

        $user = User::query()->findOrFail($request->integer('id'));

        $user->forceFill(['withdrawals_disabled' => true])->save();



        Toast::info(__('Withdrawals disabled for :member.', [

            'member' => MemberCode::format($user->member_number),

        ]));



        return redirect()->route('platform.data.team');

    }



    public function enableWithdrawals(Request $request): RedirectResponse

    {

        $user = User::query()->findOrFail($request->integer('id'));

        $user->forceFill(['withdrawals_disabled' => false])->save();



        Toast::info(__('Withdrawals enabled for :member.', [

            'member' => MemberCode::format($user->member_number),

        ]));



        return redirect()->route('platform.data.team');

    }

}



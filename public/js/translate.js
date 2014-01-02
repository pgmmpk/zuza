(function(angular) {

	var module = angular.module('zuza.translate', ['pascalprecht.translate']);
	
	module.config(['$translateProvider', function($translateProvider) {
		$translateProvider.translations('en', {

			'Welcome, user': 'Welcome, {{username}} ',
			'title-files'  : 'My files',
			'title-login'  : 'Login',
			'title-public' : 'Pubic files',
			'title-settings' : 'Settings',
			'title-'       : 'Dashboard',
			
			'month-01'         : 'January',
			'month-02'         : 'February',
			'month-03'         : 'March',
			'month-04'         : 'April',
			'month-05'         : 'May',
			'month-06'         : 'June',
			'month-07'         : 'July',
			'month-08'         : 'August',
			'month-09'         : 'September',
			'month-10'         : 'October',
			'month-11'         : 'November',
			'month-12'         : 'December'
		})
		.translations('ru', {

			'Zuza'             : 'Жужа',
			'Welcome, user'    : 'Добро пожаловать, {{username}} ',
			'Login'            : 'Войти',
			'Logout'           : 'Выйти',
			'Register'         : 'Зарегистрироваться',
			'Username'         : 'Имя пользователя',
			'Password'         : 'Пароль',
			'Confirm password' : 'Повторите пароль',
			'Login/Register'   : 'Регистратура',
			'Upload'           : 'Загрузить',
			'Browse'           : 'Выбрать',
			'Upload all'       : 'Загрузить всё',
			'Clear all'        : 'Очистить всё',
			'Files to be uploaded': 'Файлы для загрузки',
			'Wait, please'     : 'Подождите пожалуйcта',
			'My files'         : 'Мои файлы',
			'Public files'     : 'Общие файлы',
			'More'             : 'Далее',
			'Set Private'      : 'Скрыть',
			'Set Public'       : 'Открыть для всех',
			'Delete'           : 'Стереть',
			'Download'         : 'Скачать',
			'Dashboard'        : 'Лента',
			'No files'         : 'Ничего нет',
			'Nothing new'      : 'Ничего нового',
			'No files. Use "Upload" button to upload files.': 'Ничего нет. Чтобы загрузить файлы, нажмите кнопку "Загрузить".',
			'Select All/None'  : 'Отметить всё или ничего',

			'title-files'      : 'Мои файлы',
			'title-public'     : 'Общие файлы',
			'title-login'      : 'Регистратура',
			'title-settings'   : 'Настройки',
			'title-'           : 'Лента',

			'Settings'         : 'Настройки',
			'Language'         : 'Язык',
			'Public'           : 'Открыт для всех',
			'Private'          : 'Скрыт',
			'Privacy'          : 'Открытость',
			'Automatically make all uploaded files public' : 'Загруженные файлы автоматически открывать для всех',
			'... and make public' : '... и открыть для всех',
			'Loading...'       : 'Тружусь...',
			'Older files'      : 'Старое',
			'No more'          : 'Конец',
			'Users'            : 'Список пользователей',
			'Add user'         : 'Добавить пользователя',
			'Full Name'        : 'Полное имя',
			'Save'             : 'Сохранить',
			'Server error'     : 'Ашипка сервера',
			'Invalid input'    : 'Чевота не то ввели',
			'Invalid password or username': 'Неправильно введен пароль или имя',
			'Admin Role'       : 'С правами администратора',
			'Upload incomplete: file too big': 'Загрузка не прошла: слишком длинный файл',
			'Edit'             : 'Изменить',
			'Delete'           : 'Удалить',
			'Slides'           : 'Слайды',
			
			'month-01'         : 'Январь',
			'month-02'         : 'Февраль',
			'month-03'         : 'Март',
			'month-04'         : 'Апрель',
			'month-05'         : 'Май',
			'month-06'         : 'Июнь',
			'month-07'         : 'Июль',
			'month-08'         : 'Август',
			'month-09'         : 'Сентябрь',
			'month-10'         : 'Октябрь',
			'month-11'         : 'Ноябрь',
			'month-12'         : 'Декабрь'
		})
		.preferredLanguage('ru');
		//.preferredLanguage('en')
	}]);
	
	function dateParts(date) {
		if (date.year && date.month && date.day) {
			return date; // already parsed
		}
		date = new Date(date);
		var year = '' + date.getFullYear();
		var month = '' + (date.getMonth() + 1);
		if (month.length < 2) {
			month = '0' + month;
		}
		var day = '' + date.getDate();
		if (day.length < 2) {
			day = '0' + day;
		}
		return {year: year, month: month, day: day};
	}
	
	var ruMonths = {
		'01': 'января',
		'02': 'февраля',
		'03': 'марта',
		'04': 'апреля',
		'05': 'мая',
		'06': 'июня',
		'07': 'июля',
		'08': 'августа',
		'09': 'сентября',
		'10': 'октября',
		'11': 'ноабря',
		'12': 'декабря'
	};
	
	var dateFormatters = {
		'en': function(date) {
			date = dateParts(date);
			return  [date.month, date.day, date.year].join('/');
		},
		
		'ru': function(date) {
			date = dateParts(date);
			return  '' + +date.day + ' ' + ruMonths[date.month] + ' ' + date.year;
		}
	};
	
	function getDateFormatter(lang) {
		lang = lang || 'ru';
		
		var fmt = dateFormatters[lang || 'ru'];
		return fmt || dateFormatters['en'];
	}
	
	module.filter('langDate', ['$translate', function($translate) {
		return function(date) {
			if (!date) {
				return '';
			}
			var dateFormatter = getDateFormatter($translate.uses());
			return dateFormatter(date);
		};
	}]);
})(angular);